// Date-only values ('YYYY-MM-DD', from <input type="date">) must be read and written in local time.
// new Date('2026-10-01') is UTC midnight - the evening of Sep 30 in Ohio - which shifts logs into
// the previous day, and on Oct 1 into the previous fiscal year.

// 'YYYY-MM-DD' -> local midnight. Other values fall through to new Date().
export const parseLocalDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

// Today as 'YYYY-MM-DD' in local time (toISOString() would give tomorrow after ~8pm)
export const todayLocalIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
