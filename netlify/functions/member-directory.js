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
    const snap = await db.collection('members').get()

    const members = snap.docs
      .map((d) => {
        const data = d.data()
        return {
          firstName: data.FirstName || '',
          lastName: data.LastName || '',
          familyName: [data.FirstName2, data.LastName2].filter(Boolean).join(' '),
          email: data.Email || '',
          phone: data.Phone1 || '',
          membershipType: data.MembershipType || ''
        }
      })
      .filter((m) => m.email && !['inactive', 'nonmember'].includes(m.membershipType.toLowerCase()))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members })
    }
  } catch (err) {
    return { statusCode: 500, body: `Server error: ${err.message}` }
  }
}
