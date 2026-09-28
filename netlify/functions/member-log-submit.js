import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

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

// Mirrors logsStore.js's logType() getter so credited hours match what the portal computes.
const TYPES = {
  MAINT: 'Cleaning / Maintenance (2x + Blue Ribbon)',
  STANDARD: 'Standard / Regular (1x)',
  SETUP: 'Trial Setup / Teardown (2x)'
}

function resolveType(rawType) {
  const val = String(rawType || '').toUpperCase()
  if (val === 'MAINT' || val === TYPES.MAINT.toUpperCase()) return TYPES.MAINT
  if (val === 'SETUP' || val === TYPES.SETUP.toUpperCase()) return TYPES.SETUP
  return TYPES.STANDARD
}

function isDoubleCredit(type) {
  return type === TYPES.MAINT || type === TYPES.SETUP
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

  const activity = String(payload.activity || '').trim()
  if (!activity) {
    return { statusCode: 400, body: 'Activity is required' }
  }

  const clockHours = Number(payload.clockHours)
  if (!Number.isFinite(clockHours) || clockHours <= 0) {
    return { statusCode: 400, body: 'clockHours must be a positive number' }
  }

  const dateInput = payload.date ? new Date(payload.date) : new Date()
  if (Number.isNaN(dateInput.getTime())) {
    return { statusCode: 400, body: 'Invalid date' }
  }

  const type = resolveType(payload.type)

  try {
    const db = getDb()
    const memberSnap = await db.collection('members').where('Email', '==', email).limit(1).get()
    if (memberSnap.empty) {
      return { statusCode: 404, body: 'No member found for that email' }
    }
    const member = memberSnap.docs[0].data()
    const memberName = `${member.LastName || ''}, ${member.FirstName || ''}`.trim()

    const roundedClockHours = Math.max(0.25, Math.round(clockHours * 4) / 4)
    const hours = isDoubleCredit(type) ? roundedClockHours * 2 : roundedClockHours

    await db.collection('logs').add({
      MemberEmail: email,
      MemberName: memberName,
      Activity: activity,
      type,
      Sport: '',
      Date: Timestamp.fromDate(dateInput),
      clockHours: roundedClockHours,
      Hours: hours,
      Status: 'pending',
      SourceSheet: 'wp-plugin',
      FiscalYearRollover: 'No'
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, clockHours: roundedClockHours, hours, type })
    }
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` }
  }
}
