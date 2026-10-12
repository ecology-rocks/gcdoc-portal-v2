// Voucher rules - the single place the portal decides how many vouchers a member earned.
// (The Netlify member-report function and WP plugin still carry their own copy of the
// service-voucher rule; keep them in sync if these change.)

export const SERVICE_VOUCHER_MIN_HOURS = 50 // credited hours needed before any service vouchers
export const SERVICE_VOUCHER_HOURS_EACH = 25 // credited hours per service voucher
export const BLUE_VOUCHER_HOURS_EACH = 8 // cleaning/maintenance clock hours per blue voucher

const DOUBLED_TYPES = ['Cleaning / Maintenance', 'Trial Setup']
const BLUE_TYPE = 'Cleaning / Maintenance'

export const isBlueRibbonLog = (log) => (log.type || '').includes(BLUE_TYPE)

// Actual hours worked. Older logs may lack clockHours, so infer it from credited Hours.
export const clockHoursForLog = (log) => {
  const rawClock = Number(log.clockHours)
  if (!Number.isNaN(rawClock) && rawClock > 0) return rawClock
  const credited = Number(log.Hours) || 0
  return DOUBLED_TYPES.some(t => (log.type || '').includes(t)) ? credited / 2 : credited
}

// Service vouchers from a fiscal year's credited hours (doubling already applied)
export const serviceVouchersFor = (creditedHours) =>
  creditedHours >= SERVICE_VOUCHER_MIN_HOURS ? Math.floor(creditedHours / SERVICE_VOUCHER_HOURS_EACH) : 0

// Blue vouchers from a fiscal year's cleaning/maintenance clock hours - rounded down, so a
// voucher takes a full 8 hours
export const blueVouchersFor = (cleaningClockHours) => Math.floor(cleaningClockHours / BLUE_VOUCHER_HOURS_EACH)

// Instructors: per class taught in a session, 1 Blue Ribbon voucher if they attended at least
// INSTRUCTOR_MIN_WEEKS of the session, plus INSTRUCTOR_HOURS_PER_WEEK service hours per week attended
export const INSTRUCTOR_SESSION_WEEKS = 7
export const INSTRUCTOR_MIN_WEEKS = 5
export const INSTRUCTOR_HOURS_PER_WEEK = 1

// Who gets vouchers, by *current* membership type:
//   'earns'   - Regular, Family, Lifetime
//   'pending' - Applicants: hours are kept, and become vouchers once they're voted in
//   'none'    - Associate, Inactive, Nonmember, or no member record
const EARNING_TYPES = ['regular', 'family', 'lifetime']
export const voucherEligibility = (membershipType) => {
  const type = (membershipType || '').trim().toLowerCase()
  if (EARNING_TYPES.includes(type)) return 'earns'
  if (type === 'applicant') return 'pending'
  return 'none'
}

// How to show a computed voucher count given eligibility: earned as-is, pending in
// parentheses, not eligible as a dash
export const formatVoucherCount = (count, eligibility) => {
  if (eligibility === 'earns') return String(count)
  if (eligibility === 'pending') return count ? `(${count})` : '0'
  return '—'
}

export const VOUCHER_ELIGIBILITY_NOTE = {
  earns: '',
  pending: 'Pending vote-in',
  none: 'Not eligible'
}

// Fiscal year runs Oct 1 - Sep 30, identified by its starting calendar year
export const fiscalYearBounds = (startYear) => ({
  start: new Date(startYear, 9, 1),
  end: new Date(startYear + 1, 9, 1)
})

// Per-member voucher totals for one fiscal year, from raw logs
export const voucherTotalsByMember = (logs, fyStartYear) => {
  const { start, end } = fiscalYearBounds(fyStartYear)
  const totals = {}

  logs.forEach((log) => {
    const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date)
    if (!(d >= start && d < end)) return
    const email = (log.MemberEmail || 'unknown').toLowerCase()
    if (!totals[email]) totals[email] = { creditedHours: 0, cleaningClockHours: 0 }
    totals[email].creditedHours += Number(log.Hours) || 0
    if (isBlueRibbonLog(log)) totals[email].cleaningClockHours += clockHoursForLog(log)
  })

  for (const email in totals) {
    const t = totals[email]
    t.serviceVouchers = serviceVouchersFor(t.creditedHours)
    t.blueVouchers = blueVouchersFor(t.cleaningClockHours)
  }
  return totals
}
