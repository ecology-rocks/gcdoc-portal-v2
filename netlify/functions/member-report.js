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
    const totalHours = logs.reduce((sum, l) => sum + l.hours, 0)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        // Kept for backward compatibility with the current-year-only display.
        fiscalYear: currentFy?.label || '',
        fiscalYearHours: currentFy?.hours || 0,
        vouchers: currentFy?.vouchers || 0,
        totalHours: Math.round(totalHours * 100) / 100,
        fiscalYears,
        logs
      })
    }
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` }
  }
}
