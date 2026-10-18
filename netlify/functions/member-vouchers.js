import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import QRCode from 'qrcode'

// A member's published, not-yet-used voucher cards, for the "Your vouchers" reprint section of the
// WordPress [gcdoc_voucher] page. Unpublished cards (status 'created') stay hidden so a mistaken set can be
// deleted before the member sees it; stored status 'printed' is what the portal calls "Published".
// Reprinting doesn't change a card's status - the code is the voucher, so a reprint and the original
// are the same voucher and only one can ever be marked used.
//
// POST { email } -> { cards: [{ code, type, source, memberName, fyLabel, reason, status, qr }] }

function getDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    initializeApp({ credential: cert(serviceAccount) })
  }
  return getFirestore()
}

// Keep in sync with VOUCHER_REDEEM_URL in src/stores/vouchersStore.js
const VOUCHER_REDEEM_URL = 'https://gcdoc.com/voucher/'
const fyLabel = (startYear) => `FY${String(Number(startYear) + 1).slice(-2)}`
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

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
  if (!/.+@.+\..+/.test(email)) {
    return { statusCode: 400, body: 'A valid email is required' }
  }

  try {
    const db = getDb()
    const snap = await db.collection('vouchers').where('memberEmail', '==', email).get()
    const unused = snap.docs
      .map(d => d.data())
      .filter(v => v.status === 'printed' || v.status === 'handed_out')
      // Newest fiscal year first; service before Blue Ribbon, like the printed stacks
      .sort((a, b) => b.fiscalYear - a.fiscalYear || (a.type === b.type ? 0 : a.type === 'class' ? -1 : 1) || a.code.localeCompare(b.code))

    const cards = await Promise.all(unused.map(async v => {
      const svg = await QRCode.toString(`${VOUCHER_REDEEM_URL}?code=${v.code}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      return {
        code: v.code,
        type: v.type,
        source: v.source,
        memberName: v.memberName || '',
        fyLabel: fyLabel(v.fiscalYear),
        reason: v.reason || '',
        status: v.status,
        qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
      }
    }))

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cards }) }
  } catch (err) {
    console.error('member-vouchers failed', err)
    return { statusCode: 500, body: 'Voucher lookup failed' }
  }
}
