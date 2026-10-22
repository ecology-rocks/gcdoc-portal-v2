import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// Look up, redeem or claim a voucher card for the WordPress [gcdoc_voucher] page. The WP plugin decides
// who may redeem (site Administrators or the shared PIN) and calls this with the shared secret.
//
// POST { code, action: 'lookup' | 'redeem', redeemedBy }
// -> { found, code, type, memberName, fiscalYear, fyLabel, reason, status, usedAt, usedBy, claimable, justRedeemed }
//
// Claim: a logged-in WP user adds a write-in card (issued with no person) to their account, so it shows in
// their voucher list and can be reprinted if the card is lost. The plugin sends the WP account's email.
// POST { code, action: 'claim', email, name } -> the lookup fields + claimResult:
//   'claimed' | 'already_yours' | 'taken' (someone else's card) | 'used'

// Reused across warm invocations so we don't re-init Firebase on every request.
function getDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    initializeApp({ credential: cert(serviceAccount) })
  }
  return getFirestore()
}

// Codes are 6 characters from an unambiguous alphabet (see src/stores/vouchersStore.js)
const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const isValidCode = (code) => /^[A-Z0-9]{6}$/.test(code)

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const memberName = (m) => `${m.FirstName || ''} ${m.LastName || ''}`.trim()

const fyLabel = (startYear) => `FY${String(Number(startYear) + 1).slice(-2)}`

function describe(code, data, justRedeemed = false) {
  return {
    found: true,
    code,
    type: data.type,
    memberName: data.memberName || '',
    fiscalYear: data.fiscalYear,
    fyLabel: fyLabel(data.fiscalYear),
    reason: data.reason || '',
    status: data.status,
    usedAt: data.usedAt?.toDate ? data.usedAt.toDate().toISOString() : null,
    usedBy: data.usedBy || '',
    claimable: !data.memberEmail && data.status !== 'used',
    justRedeemed
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

  const code = normalizeCode(payload.code)
  if (!isValidCode(code)) {
    return json({ found: false, code })
  }

  const action = ['redeem', 'claim'].includes(payload.action) ? payload.action : 'lookup'
  const redeemedBy = String(payload.redeemedBy || 'website').slice(0, 100)

  try {
    const db = getDb()
    const ref = db.collection('vouchers').doc(code)

    if (action === 'lookup') {
      const snap = await ref.get()
      return json(snap.exists ? describe(code, snap.data()) : { found: false, code })
    }

    if (action === 'claim') {
      const email = normalizeEmail(payload.email)
      if (!/.+@.+\..+/.test(email)) {
        return { statusCode: 400, body: 'A valid email is required to claim a voucher' }
      }
      // Name the card the way issued cards are named; someone with no member record (e.g. a trial
      // worker with a website account) gets their WP display name
      const memberSnap = await db.collection('members').doc(email).get()
      const name = (memberSnap.exists && memberName(memberSnap.data())) || String(payload.name || '').trim().slice(0, 80) || email

      // Transaction so two people entering the same code can't both claim it
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists) return { found: false, code }
        const data = snap.data()
        if (data.memberEmail) {
          return { ...describe(code, data), claimResult: data.memberEmail === email ? 'already_yours' : 'taken' }
        }
        if (data.status === 'used') return { ...describe(code, data), claimResult: 'used' }

        const update = { memberEmail: email, memberName: name, claimedAt: Timestamp.now() }
        // Someone is holding the card, so an unpublished one is in fact handed out - and it has to be
        // published for the member to see it in their list (and it shouldn't be deletable any more)
        if (data.status === 'created') Object.assign(update, { status: 'handed_out', handedOutAt: Timestamp.now() })
        tx.update(ref, update)
        return { ...describe(code, { ...data, ...update }), claimResult: 'claimed' }
      })
      return json(result)
    }

    // Redeem in a transaction so two people scanning the same card can't both succeed
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { found: false, code }
      const data = snap.data()
      if (data.status === 'used') return describe(code, data, false)

      const update = { status: 'used', usedAt: Timestamp.now(), usedBy: redeemedBy }
      tx.update(ref, update)
      return describe(code, { ...data, ...update }, true)
    })
    return json(result)
  } catch (err) {
    console.error('voucher-redeem failed', err)
    return { statusCode: 500, body: 'Voucher lookup failed' }
  }
}

function json(body) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
