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
function getFiscalYearRange(now = new Date()) {
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const startYear = currentMonth >= 9 ? currentYear : currentYear - 1
  return {
    start: new Date(startYear, 9, 1),
    end: new Date(startYear + 1, 9, 1),
    label: `Oct 1, ${startYear} - Sep 30, ${startYear + 1}`
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
    const snap = await db.collection('logs').where('MemberEmail', '==', email).get()

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

    const { start, end, label } = getFiscalYearRange()
    const fyHours = logs
      .filter((l) => {
        const d = new Date(l.date)
        return d >= start && d < end
      })
      .reduce((sum, l) => sum + l.hours, 0)

    const totalHours = logs.reduce((sum, l) => sum + l.hours, 0)
    const vouchers = fyHours >= 50 ? Math.floor(fyHours / 25) : 0

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        fiscalYear: label,
        fiscalYearHours: Math.round(fyHours * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        vouchers,
        logs
      })
    }
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` }
  }
}
