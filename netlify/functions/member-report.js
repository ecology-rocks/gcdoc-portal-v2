import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Reused across warm invocations so we don't re-init Firebase on every request.
function getDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    initializeApp({ credential: cert(serviceAccount) })
  }
  return getFirestore()
}

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const isValidEmail = (value) => /.+@.+\..+/.test(value)

// FY runs Oct 1 - Sep 30, matching the app's existing convention.
function getFiscalYearForDate(date) {
  const month = date.getMonth()
  const year = date.getFullYear()
  const startYear = month >= 9 ? year : year - 1
  return {
    startYear,
    start: new Date(startYear, 9, 1),
    end: new Date(startYear + 1, 9, 1),
    label: `${startYear}-${startYear + 1} (Oct 1, ${startYear} - Sep 30, ${startYear + 1})`
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

  const email = normalizeEmail(payload.email)
  if (!email || !isValidEmail(email)) {
    return { statusCode: 400, body: 'A valid email is required' }
  }

  try {
    const db = getDb()
    const [snap, memberSnap] = await Promise.all([
      db.collection('logs').where('MemberEmail', '==', email).get(),
      db.collection('members').where('Email', '==', email).limit(1).get()
    ])
    const memberData = memberSnap.docs[0]?.data() || {}
    const membershipType = memberData.MembershipType || ''
    const dues2026Paid = Boolean(memberData.Dues2026Paid)

    const logs = snap.docs
      .map((d) => {
        const data = d.data()
        const date = data.Date?.toDate ? data.Date.toDate() : new Date(data.Date)
        return {
          date: date.toISOString(),
          activity: data.Activity || '',
          type: data.type || '',
          hours: Number(data.Hours) || 0
        }
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))

    // Group logs into fiscal years so members can see prior years too, not just the current one.
    const fyByStartYear = new Map()
    for (const log of logs) {
      const fy = getFiscalYearForDate(new Date(log.date))
      if (!fyByStartYear.has(fy.startYear)) {
        fyByStartYear.set(fy.startYear, { label: fy.label, startYear: fy.startYear, hours: 0, logs: [] })
      }
      const bucket = fyByStartYear.get(fy.startYear)
      bucket.hours += log.hours
      bucket.logs.push(log)
    }

    const fiscalYears = [...fyByStartYear.values()]
      .sort((a, b) => b.startYear - a.startYear)
      .map((fy) => ({
        label: fy.label,
        hours: Math.round(fy.hours * 100) / 100,
        vouchers: fy.hours >= 50 ? Math.floor(fy.hours / 25) : 0,
        logs: fy.logs
      }))

    const currentFyStartYear = getFiscalYearForDate(new Date()).startYear
    const currentFy = fiscalYears.find((fy) => fy.label.startsWith(String(currentFyStartYear)))

    // Dues keep showing against the prior FY for 3 months after it ends (through Dec 31),
    // so members aren't hit with a new FY's requirements before they've paid the old one.
    const duesDate = new Date()
    duesDate.setMonth(duesDate.getMonth() - 3)
    const duesFyStartYear = getFiscalYearForDate(duesDate).startYear
    const duesFy = fiscalYears.find((fy) => fy.label.startsWith(String(duesFyStartYear)))

    // Members voted in after July 1 skip dues for the FY cycle that starts the following Oct 1 -
    // e.g. voted in Aug 1, 2026 means no dues owed for the FY starting Oct 1, 2026. Only applies
    // when a VotedInDate is actually on file; most existing members don't have one recorded.
    let duesExemptVotedIn = false
    if (memberData.VotedInDate) {
      const votedInDate = new Date(memberData.VotedInDate)
      if (!Number.isNaN(votedInDate.getTime())) {
        const cutoffStart = new Date(duesFyStartYear, 6, 1) // July 1 of the dues cycle's start year
        const cycleStart = new Date(duesFyStartYear, 9, 1) // Oct 1 of the dues cycle's start year
        duesExemptVotedIn = votedInDate >= cutoffStart && votedInDate < cycleStart
      }
    }

    const totalHours = logs.reduce((sum, l) => sum + l.hours, 0)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        membershipType,
        // Kept for backward compatibility with the current-year-only display.
        fiscalYear: currentFy?.label || '',
        fiscalYearHours: currentFy?.hours || 0,
        vouchers: currentFy?.vouchers || 0,
        duesFiscalYear: duesFy?.label || '',
        duesFiscalYearHours: duesFy?.hours || 0,
        dues2026Paid,
        votedInDate: memberData.VotedInDate || '',
        duesExemptVotedIn,
        totalHours: Math.round(totalHours * 100) / 100,
        fiscalYears,
        logs
      })
    }
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` }
  }
}
