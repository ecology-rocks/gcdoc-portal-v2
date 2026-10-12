import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/authStore'
import { useLogsStore } from '@/stores/logsStore'
import { INSTRUCTOR_MIN_WEEKS, INSTRUCTOR_SESSION_WEEKS, INSTRUCTOR_HOURS_PER_WEEK } from '@/utils/vouchers'
import { collection, onSnapshot, doc, writeBatch, Timestamp, deleteDoc } from 'firebase/firestore'

// --- Voucher ledger ---
// One doc per physical voucher card at vouchers/{code}. The code is the doc ID, is printed on
// the card, and is what the card's QR code points to. Lifecycle (status):
//   created -> printed -> handed_out -> used
// Fields: code, type ('class' = Service Voucher | 'blue' = Blue Ribbon Voucher), source ('earned' | 'manual'), memberEmail, memberName,
//   fiscalYear (FY start year, e.g. 2025 for FY26), reason (manual only, printed on the card),
//   set (manual sets, e.g. trial workers), createdAt/By, printedAt, handedOutAt, usedAt, usedBy.
// "used" is normally set from the website (netlify/functions/voucher-redeem.js).

export const VOUCHER_TYPES = {
  class: { label: 'Service Voucher', short: 'Service', value: 'Good for one class' },
  blue: { label: 'Blue Ribbon Voucher', short: 'Blue Ribbon', value: '$20 off one trial entry', alt: 'Can also be used for one free class' }
}

// The website page (WP plugin [gcdoc_voucher] shortcode) each card's QR code opens
export const VOUCHER_REDEEM_URL = 'https://gcdoc.com/voucher/'
export const voucherUrl = (code) => `${VOUCHER_REDEEM_URL}?code=${code}`

export const fyLabel = (startYear) => `FY${String(Number(startYear) + 1).slice(-2)}`

// No 0/O, 1/I/L, 5/S, 2/Z: easy to read aloud and type from a smudged card. 28^6 ~ 480M codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXY3456789'
const CODE_LENGTH = 6

const randomCode = () => {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

// Firestore batches top out at 500 writes
const BATCH_LIMIT = 450

export const useVouchersStore = defineStore('vouchers', {
  state: () => ({
    vouchers: [],
    loading: false,
    error: null,
    unsubscribe: null
  }),

  getters: {
    // { [memberEmail]: { class: { created, printed, handed_out, used, total }, blue: {...} } } for one FY
    countsByMember: (state) => (fyStartYear, source = null) => {
      const map = {}
      state.vouchers.forEach(v => {
        if (v.fiscalYear !== fyStartYear) return
        if (source && v.source !== source) return
        const email = v.memberEmail || v.memberName
        if (!map[email]) map[email] = { class: emptyCounts(), blue: emptyCounts() }
        const c = map[email][v.type] || (map[email][v.type] = emptyCounts())
        c[v.status] = (c[v.status] || 0) + 1
        c.total++
      })
      return map
    }
  },

  actions: {
    async initVouchers() {
      if (this.unsubscribe) return
      const authStore = useAuthStore()
      if (authStore.loading) await authStore.init()
      if (!authStore.isAdmin) {
        this.error = 'Admin access required to view vouchers.'
        return
      }

      this.loading = true
      this.unsubscribe = onSnapshot(
        collection(db, 'vouchers'),
        (snap) => {
          this.vouchers = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          this.loading = false
          this.error = null
        },
        (error) => {
          this.loading = false
          this.error = error?.code === 'permission-denied'
            ? 'Vouchers are blocked by the database rules - the vouchers rule needs to be published.'
            : error?.message || 'Unable to load vouchers.'
        }
      )
    },

    newCode() {
      const taken = new Set(this.vouchers.map(v => v.code))
      let code
      do { code = randomCode() } while (taken.has(code))
      return code
    },

    // specs: [{ type, memberEmail, memberName, fiscalYear, source, reason }] - one card each
    async createVouchers(specs) {
      const by = useAuthStore().user?.email || ''
      const taken = new Set(this.vouchers.map(v => v.code))
      const docs = specs.map(spec => {
        let code
        do { code = randomCode() } while (taken.has(code))
        taken.add(code)
        return {
          code,
          type: spec.type,
          source: spec.source,
          memberEmail: spec.memberEmail || '',
          memberName: spec.memberName || '',
          fiscalYear: spec.fiscalYear,
          reason: spec.reason || '',
          // Issued as part of a set (e.g. a trial): { kind, setId, label, role, days, perDay, ... }
          ...(spec.set ? { set: spec.set } : {}),
          status: 'created',
          createdAt: Timestamp.now(),
          createdBy: by
        }
      })
      for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db)
        docs.slice(i, i + BATCH_LIMIT).forEach(v => batch.set(doc(db, 'vouchers', v.code), v))
        await batch.commit()
      }
      return docs.length
    },

    // Bring earned vouchers up to what each eligible member's hours earn. Only adds; if someone
    // already has more than they now earn (hours corrected down), nothing is removed.
    // earned: [{ memberEmail, memberName, class: n, blue: n }]
    async syncEarnedVouchers(fyStartYear, earned) {
      const existing = this.countsByMember(fyStartYear, 'earned')
      const specs = []
      earned.forEach(e => {
        for (const type of ['class', 'blue']) {
          const have = existing[e.memberEmail]?.[type]?.total || 0
          for (let n = have; n < e[type]; n++) {
            specs.push({ type, source: 'earned', fiscalYear: fyStartYear, memberEmail: e.memberEmail, memberName: e.memberName })
          }
        }
      })
      return this.createVouchers(specs)
    },

    // An instructor session from the registrar's list. Per row (one instructor, one class):
    // INSTRUCTOR_MIN_WEEKS+ weeks -> 1 Blue Ribbon voucher; every week attended -> service hours.
    // Vouchers and hour logs are written together. rows: [{ className, instructorName, memberEmail, weeks }]
    // fiscalYear (FY start year) is chosen on the form - e.g. Session 5 2026 counts toward FY27. If the
    // session end date falls outside that FY, the hours are dated the FY's first day (Oct 1) so they
    // count in the same year as the vouchers.
    async issueInstructorSession({ sessionName, sessionDate, fiscalYear, rows }) {
      const by = useAuthStore().user?.email || ''
      const date = instructorLogDate(sessionDate, fiscalYear)
      const setId = `instructors-${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      const sourceSheet = `instructor-session:${sessionName}`
      const standardType = useLogsStore().logType('STANDARD')

      const taken = new Set(this.vouchers.map(v => v.code))
      const writes = []
      let voucherCount = 0
      let hours = 0

      rows.forEach(row => {
        const email = row.memberEmail.toLowerCase()
        if (row.weeks >= INSTRUCTOR_MIN_WEEKS) {
          let code
          do { code = randomCode() } while (taken.has(code))
          taken.add(code)
          voucherCount++
          writes.push([doc(db, 'vouchers', code), {
            code,
            type: 'blue',
            source: 'manual',
            memberEmail: email,
            memberName: row.instructorName,
            fiscalYear,
            reason: `${sessionName} · ${row.className}`,
            set: { kind: 'instructor', setId, label: `Instructors · ${sessionName}`, session: sessionName, role: row.className, weeks: row.weeks },
            status: 'created',
            createdAt: Timestamp.now(),
            createdBy: by
          }])
        }
        const rowHours = row.weeks * INSTRUCTOR_HOURS_PER_WEEK
        if (rowHours > 0) {
          hours += rowHours
          writes.push([doc(collection(db, 'logs')), {
            MemberEmail: email,
            Date: Timestamp.fromDate(date),
            Activity: `Instructor - ${row.className} (${sessionName}, ${row.weeks} of ${INSTRUCTOR_SESSION_WEEKS} weeks)`,
            type: standardType,
            clockHours: rowHours,
            Hours: rowHours,
            SourceSheet: sourceSheet,
            Status: 'approved',
            FiscalYearRollover: 'No',
            createdAt: Timestamp.now()
          }])
        }
      })

      for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db)
        writes.slice(i, i + BATCH_LIMIT).forEach(([ref, data]) => batch.set(ref, data))
        await batch.commit()
      }
      return { voucherCount, hours }
    },

    // Has this instructor session name been issued before? (vouchers or hour logs)
    instructorSessionExists(sessionName) {
      const name = sessionName.trim().toLowerCase()
      const sourceSheet = `instructor-session:${sessionName.trim()}`.toLowerCase()
      return this.vouchers.some(v => v.set?.kind === 'instructor' && (v.set.session || '').toLowerCase() === name) ||
        useLogsStore().logs.some(l => String(l.SourceSheet || '').toLowerCase() === sourceSheet)
    },

    async setStatus(vouchers, status) {
      const field = { printed: 'printedAt', handed_out: 'handedOutAt' }[status]
      if (!field) throw new Error(`Status ${status} can't be set from the portal`)
      for (let i = 0; i < vouchers.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db)
        vouchers.slice(i, i + BATCH_LIMIT).forEach(v => {
          batch.update(doc(db, 'vouchers', v.code), { status, [field]: Timestamp.now() })
        })
        await batch.commit()
      }
    },

    // Only for vouchers that were never printed - a printed card may already be out in the world
    async deleteUnprintedVoucher(code) {
      const v = this.vouchers.find(x => x.code === code)
      if (!v || v.status !== 'created') throw new Error('Only vouchers that have not been printed can be deleted.')
      await deleteDoc(doc(db, 'vouchers', code))
    }
  }
})

// FY start year for a 'YYYY-MM-DD' date (fiscal year runs Oct 1 - Sep 30)
export const fiscalYearOfDate = (isoDate) => {
  const [y, m] = isoDate.split('-').map(Number)
  return m >= 10 ? y : y - 1
}

// The date instructor hours are logged on: the session end date if it's inside the chosen fiscal
// year, otherwise the nearest day of that year - Oct 1 if the session ended before it (e.g. a late
// September Session 5 counted toward the next FY), Sep 30 if after. Local midnight, so the FY is right.
export const instructorLogDate = (isoDate, fiscalYear) => {
  const dateFy = fiscalYearOfDate(isoDate)
  if (dateFy === fiscalYear) {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return dateFy < fiscalYear ? new Date(fiscalYear, 9, 1) : new Date(fiscalYear + 1, 8, 30)
}

function emptyCounts() {
  return { created: 0, printed: 0, handed_out: 0, used: 0, total: 0 }
}
