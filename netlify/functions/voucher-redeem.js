import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// Look up or redeem a voucher card for the WordPress [gcdoc_voucher] page. The WP plugin decides
// who may redeem (site Administrators or the shared PIN) and calls this with the shared secret.
//
// POST { code, action: 'lookup' | 'redeem', redeemedBy }
// -> { found, code, type, memberName, fiscalYear, fyLabel, reason, status, usedAt, usedBy, justRedeemed }

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

  const action = payload.action === 'redeem' ? 'redeem' : 'lookup'
  const redeemedBy = String(payload.redeemedBy || 'website').slice(0, 100)

  try {
    const db = getDb()
    const ref = db.collection('vouchers').doc(code)

    if (action === 'lookup') {
      const snap = await ref.get()
      return json(snap.exists ? describe(code, snap.data()) : { found: false, code })
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
