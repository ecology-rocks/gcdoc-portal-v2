import { randomBytes } from 'node:crypto'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import QRCode from 'qrcode'

// Hand-issued voucher sets from the WordPress [gcdoc_voucher_issue] page - the website twin of the
// portal's TrialVoucherIssuer / OneOffVoucherIssuer / InstructorVoucherIssuer. One difference: instructor
// hours from the website go to the portal's approval queue (Status 'pending'), not straight to approved. The WP plugin decides
// who may call this (site Administrators or the admin PIN) and passes issuedBy.
//
// POST { action, ... } with the shared secret:
//   issue              { kind: 'trial' | 'oneoff' | 'instructor', fiscalYear, issuedBy, ...kind fields }
//                      -> { ok, setId, voucherCount, hours }, or { ok: false, duplicate: true } for an
//                      instructor session name already used (resend with confirmDuplicate: true)
//   preview_instructor { sessionName, rows: [{ className, instructorName, email, weeks }] }
//                      -> { duplicate, rows: [{ ...row, memberEmail, matchNote }] }
//   set                { setId } -> { cards }            (reprint a set issued from the website)
//   mark_printed       { codes } -> { updated }       (stored 'printed' = "Published": members can see it)
//   delete_set         { setId } -> { ok, deleted }    (only while nothing in the set is published)
//
// Voucher docs match src/stores/vouchersStore.js exactly, so these sets show up in the portal's
// "Issued by hand" list like any other.

function getDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    initializeApp({ credential: cert(serviceAccount) })
  }
  return getFirestore()
}

// Keep in sync with src/stores/vouchersStore.js and src/utils/vouchers.js
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXY3456789'
const CODE_LENGTH = 6
const VOUCHER_REDEEM_URL = 'https://gcdoc.com/voucher/'
const INSTRUCTOR_SESSION_WEEKS = 7
const INSTRUCTOR_MIN_WEEKS = 5
const INSTRUCTOR_HOURS_PER_WEEK = 1
const STANDARD_LOG_TYPE = 'Standard / Regular (1x)'

const BATCH_LIMIT = 400
// A typo like "500 per day" shouldn't be able to flood the ledger from the website
const MAX_VOUCHERS_PER_ISSUE = 300
const MAX_ROWS = 300

const fyLabel = (startYear) => `FY${String(Number(startYear) + 1).slice(-2)}`
const text = (value, max = 120) => String(value ?? '').trim().slice(0, max)
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z, ]/g, '').replace(/\s+/g, ' ').trim()

class InputError extends Error {}

const randomCode = () => Array.from(randomBytes(CODE_LENGTH), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')

// n unused codes; checked against the ledger, and batch.create() below refuses to overwrite anyway
async function newCodes(db, n) {
  const codes = new Set()
  while (codes.size < n) {
    const candidates = []
    while (codes.size + candidates.length < n) {
      const c = randomCode()
      if (!codes.has(c) && !candidates.includes(c)) candidates.push(c)
    }
    const snaps = await db.getAll(...candidates.map(c => db.collection('vouchers').doc(c)))
    snaps.forEach(s => { if (!s.exists) codes.add(s.id) })
  }
  return [...codes]
}

async function loadMembers(db) {
  const snap = await db.collection('members').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

const memberName = (m) => `${m.FirstName || ''} ${m.LastName || ''}`.trim()

// FY start year for a 'YYYY-MM-DD' date (fiscal year runs Oct 1 - Sep 30)
const fiscalYearOfDate = (isoDate) => {
  const [y, m] = isoDate.split('-').map(Number)
  return m >= 10 ? y : y - 1
}

// Same rule as instructorLogDate() in vouchersStore.js: the session end date if it's inside the chosen
// FY, otherwise Oct 1 / Sep 30 of that FY. Stored at noon UTC so it's the same calendar day in Ohio.
const instructorLogDate = (isoDate, fiscalYear) => {
  const dateFy = fiscalYearOfDate(isoDate)
  if (dateFy === fiscalYear) {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d, 12))
  }
  return dateFy < fiscalYear ? new Date(Date.UTC(fiscalYear, 9, 1, 12)) : new Date(Date.UTC(fiscalYear + 1, 8, 30, 12))
}

function parseFiscalYear(value) {
  const fy = Number(value)
  const now = new Date()
  const current = now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  if (!Number.isInteger(fy) || fy < current - 2 || fy > current + 1) throw new InputError('Pick a valid fiscal year.')
  return fy
}

const parseVoucherType = (value) => (value === 'class' ? 'class' : 'blue')

// A person on a trial / one-off row: a member email, a typed name, or nobody (blank write-in line)
function resolvePerson(row, membersById) {
  const email = normalizeEmail(row.email)
  if (email) {
    const m = membersById.get(email)
    if (!m) throw new InputError(`No member found with email ${email}.`)
    return { memberEmail: email, memberName: memberName(m) }
  }
  return { memberEmail: '', memberName: text(row.name, 80) }
}

// Name -> member emails. Primary and household (second) members, "First Last" or "Last, First".
function buildNameIndex(members) {
  const index = new Map()
  const add = (first, last, email) => {
    if (!first || !last) return
    for (const key of [`${first} ${last}`, `${last}, ${first}`, `${last} ${first}`].map(normalizeName)) {
      if (!index.has(key)) index.set(key, new Set())
      index.get(key).add(email)
    }
  }
  members.forEach(m => {
    const email = normalizeEmail(m.Email || m.id)
    if (!email || m.MovedToEmail) return
    add(m.FirstName, m.LastName, email)
    add(m.FirstName2, m.LastName2 || m.LastName, email)
  })
  return index
}

async function instructorSessionExists(db, sessionName) {
  const [vouchers, logs] = await Promise.all([
    db.collection('vouchers').where('set.session', '==', sessionName).limit(1).get(),
    db.collection('logs').where('SourceSheet', '==', `instructor-session:${sessionName}`).limit(1).get()
  ])
  return !vouchers.empty || !logs.empty
}

const parseWeeks = (value) => {
  const weeks = Number(String(value ?? '').trim())
  return String(value ?? '').trim() !== '' && Number.isInteger(weeks) && weeks >= 0 && weeks <= INSTRUCTOR_SESSION_WEEKS ? weeks : null
}

async function previewInstructor(db, payload) {
  const sessionName = text(payload.sessionName)
  const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, MAX_ROWS) : []
  const members = await loadMembers(db)
  const byId = new Map(members.map(m => [m.id, m]))
  const index = buildNameIndex(members)

  const out = rows.map(r => {
    const instructorName = text(r.instructorName, 80)
    const email = normalizeEmail(r.email)
    const base = { className: text(r.className), instructorName, weeks: parseWeeks(r.weeks), weeksText: text(r.weeks, 10) }
    if (email && byId.has(email)) return { ...base, memberEmail: email, matchNote: '' }
    const found = index.get(normalizeName(instructorName))
    if (!found) return { ...base, memberEmail: '', matchNote: 'No matching member - pick one' }
    if (found.size > 1) return { ...base, memberEmail: '', matchNote: 'Matches more than one member - pick one' }
    return { ...base, memberEmail: [...found][0], matchNote: '' }
  })

  return { duplicate: sessionName ? await instructorSessionExists(db, sessionName) : false, rows: out }
}

// Build [ref, data] writes for one issue request
async function buildIssue(db, payload) {
  const kind = payload.kind
  const fiscalYear = parseFiscalYear(payload.fiscalYear)
  const issuedBy = text(payload.issuedBy, 100) || 'website'
  const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, MAX_ROWS) : []
  const members = await loadMembers(db)
  const membersById = new Map(members.map(m => [m.id, m]))

  const specs = [] // vouchers to create, minus code
  const logs = []
  let setId

  if (kind === 'trial') {
    const trialType = text(payload.trialType, 60)
    const trialDates = text(payload.trialDates, 60)
    const days = Math.trunc(Number(payload.days))
    if (!trialType || !trialDates) throw new InputError('Enter the trial type and dates.')
    if (!(days >= 1 && days <= 10)) throw new InputError('Days must be 1 to 10.')
    const label = `${trialType} ${trialDates}`
    const type = parseVoucherType(payload.voucherType)
    setId = `trial-${Date.now()}`
    rows.forEach(r => {
      const role = text(r.role, 80)
      const perDay = Math.trunc(Number(r.perDay)) || 0
      if (!role || perDay <= 0) return
      if (perDay > 20) throw new InputError(`Per day for ${role} is more than 20.`)
      const person = resolvePerson(r, membersById)
      for (let n = 0; n < perDay * days; n++) {
        specs.push({
          type, ...person, reason: `${label} · ${role}`,
          set: { kind: 'trial', setId, label, trialType, trialDates, role, days, perDay }
        })
      }
    })
  } else if (kind === 'oneoff') {
    const label = text(payload.reason, 80)
    if (!label) throw new InputError('Enter a reason.')
    const type = parseVoucherType(payload.voucherType)
    setId = `oneoff-${Date.now()}`
    rows.forEach(r => {
      const count = Math.trunc(Number(r.count)) || 0
      if (count <= 0) return
      if (count > 20) throw new InputError('No more than 20 vouchers per person.')
      const person = resolvePerson(r, membersById)
      for (let n = 0; n < count; n++) {
        specs.push({ type, ...person, reason: label, set: { kind: 'oneoff', setId, label, role: '', perPerson: count } })
      }
    })
  } else if (kind === 'instructor') {
    const sessionName = text(payload.sessionName, 80)
    const sessionDate = String(payload.sessionDate || '')
    if (!sessionName) throw new InputError('Enter a session name.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) throw new InputError('Enter the session end date.')
    // A session can legitimately come in several files (one per sport), so this is only a warning -
    // the page asks first, then resends with confirmDuplicate
    if (!payload.confirmDuplicate && await instructorSessionExists(db, sessionName)) {
      return { duplicate: true }
    }
    // Per upload (unlike the portal's per-session setId), so each file's print page shows just its own cards
    setId = `instructors-${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`
    const date = Timestamp.fromDate(instructorLogDate(sessionDate, fiscalYear))
    rows.forEach(r => {
      const email = normalizeEmail(r.email)
      const className = text(r.className)
      const weeks = parseWeeks(r.weeks)
      if (!membersById.has(email)) throw new InputError(`Pick a member for ${text(r.instructorName, 80) || className}.`)
      if (weeks === null) throw new InputError(`Weeks for ${className} must be a whole number from 0 to ${INSTRUCTOR_SESSION_WEEKS}.`)
      const member = membersById.get(email)
      const instructorName = text(r.instructorName, 80) || memberName(member)
      if (weeks >= INSTRUCTOR_MIN_WEEKS) {
        specs.push({
          type: 'blue', memberEmail: email, memberName: instructorName, reason: `${sessionName} · ${className}`,
          set: { kind: 'instructor', setId, label: `Instructors · ${sessionName}`, session: sessionName, role: className, weeks }
        })
      }
      const hours = weeks * INSTRUCTOR_HOURS_PER_WEEK
      if (hours > 0) {
        logs.push({
          MemberEmail: email,
          // "Last, First", as the approval queue shows it (same as member-log-submit.js)
          MemberName: `${member.LastName || ''}, ${member.FirstName || ''}`.trim(),
          Date: date,
          Activity: `Instructor - ${className} (${sessionName}, ${weeks} of ${INSTRUCTOR_SESSION_WEEKS} weeks)`,
          type: STANDARD_LOG_TYPE,
          clockHours: hours,
          Hours: hours,
          SourceSheet: `instructor-session:${sessionName}`,
          // The portal admin reviews website-issued hours before they count
          Status: 'pending',
          FiscalYearRollover: 'No',
          createdAt: Timestamp.now()
        })
      }
    })
  } else {
    throw new InputError('Unknown voucher kind.')
  }

  if (specs.length === 0 && logs.length === 0) throw new InputError('Nothing to issue - add at least one row.')
  if (specs.length > MAX_VOUCHERS_PER_ISSUE) throw new InputError(`That's ${specs.length} vouchers - more than ${MAX_VOUCHERS_PER_ISSUE} at once. Check the numbers.`)

  const codes = await newCodes(db, specs.length)
  const writes = specs.map((spec, i) => [db.collection('vouchers').doc(codes[i]), {
    code: codes[i],
    type: spec.type,
    source: 'manual',
    memberEmail: spec.memberEmail,
    memberName: spec.memberName,
    fiscalYear,
    reason: spec.reason,
    set: { ...spec.set, issuedFrom: 'website' },
    status: 'created',
    createdAt: Timestamp.now(),
    createdBy: issuedBy
  }])
  logs.forEach(log => writes.push([db.collection('logs').doc(), log]))

  return { setId, writes, voucherCount: specs.length, hours: logs.reduce((s, l) => s + l.Hours, 0) }
}

async function toCard(data) {
  const svg = await QRCode.toString(`${VOUCHER_REDEEM_URL}?code=${data.code}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  return {
    code: data.code,
    type: data.type,
    source: data.source,
    memberEmail: data.memberEmail || '',
    memberName: data.memberName || '',
    fyLabel: fyLabel(data.fiscalYear),
    reason: data.reason || '',
    status: data.status,
    qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' }
  }

  const providedSecret = event.headers['x-report-secret'] || payload.secret
  if (!process.env.REPORT_API_SECRET || providedSecret !== process.env.REPORT_API_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  try {
    const db = getDb()

    if (payload.action === 'preview_instructor') {
      return json(await previewInstructor(db, payload))
    }

    if (payload.action === 'issue') {
      const built = await buildIssue(db, payload)
      if (built.duplicate) return json({ ok: false, duplicate: true })
      const { setId, writes, voucherCount, hours } = built
      for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
        const batch = db.batch()
        writes.slice(i, i + BATCH_LIMIT).forEach(([ref, data]) => {
          if (ref.parent.id === 'vouchers') batch.create(ref, data)
          else batch.set(ref, data)
        })
        await batch.commit()
      }
      return json({ ok: true, setId, voucherCount, hours })
    }

    if (payload.action === 'set') {
      const setId = text(payload.setId, 100)
      if (!setId) return json({ cards: [] })
      const snap = await db.collection('vouchers').where('set.setId', '==', setId).get()
      const cards = await Promise.all(snap.docs.map(d => toCard(d.data())))
      return json({ cards })
    }

    if (payload.action === 'mark_printed') {
      const codes = (Array.isArray(payload.codes) ? payload.codes : []).map(c => String(c).toUpperCase()).filter(c => /^[A-Z0-9]{6}$/.test(c)).slice(0, MAX_VOUCHERS_PER_ISSUE)
      if (!codes.length) return json({ updated: 0 })
      const snaps = await db.getAll(...codes.map(c => db.collection('vouchers').doc(c)))
      // Only cards that haven't moved on - never knock a handed-out or used card back to printed
      const targets = snaps.filter(s => s.exists && s.data().status === 'created')
      const batch = db.batch()
      targets.forEach(s => batch.update(s.ref, { status: 'printed', printedAt: Timestamp.now() }))
      if (targets.length) await batch.commit()
      return json({ updated: targets.length })
    }

    if (payload.action === 'delete_set') {
      const setId = text(payload.setId, 100)
      if (!setId) return json({ ok: false, error: 'No set given.' })
      const snap = await db.collection('vouchers').where('set.setId', '==', setId).get()
      // Same rule as the portal's "Delete set": once any card is published it may be out in the world.
      // Hour logs are left alone - the portal admin reviews those in the approval queue.
      if (snap.docs.some(d => d.data().status !== 'created')) {
        return json({ ok: false, error: "Some of these vouchers are already published, so the set can't be deleted. Ask the portal admin." })
      }
      for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
        const batch = db.batch()
        snap.docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
      return json({ ok: true, deleted: snap.size })
    }

    return { statusCode: 400, body: 'Unknown action' }
  } catch (err) {
    if (err instanceof InputError) return json({ ok: false, error: err.message })
    console.error('voucher-issue failed', err)
    return { statusCode: 500, body: 'Voucher issue failed' }
  }
}

function json(body) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
