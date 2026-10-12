<template>
  <div class="vouchers-view">
    <div class="page-header">
      <div>
        <h1>Vouchers</h1>
        <p class="subtitle">Earned vouchers by fiscal year (Oct 1 - Sep 30), and the printed voucher cards that track them.</p>
      </div>
      <label class="fy-select">
        Fiscal year
        <select v-model.number="fyStartYear">
          <option v-for="y in fiscalYearOptions" :key="y" :value="y">{{ fyName(y) }}</option>
        </select>
      </label>
    </div>

    <!-- Rules, spelled out so they can be checked -->
    <details class="rules" open>
      <summary>Calculation rules used ({{ fyName(fyStartYear) }})</summary>
      <ol>
        <li>
          <strong>Which logs count:</strong> every log dated {{ fyRangeText }}.
        </li>
        <li>
          <strong>Who earns, by current membership type:</strong> Regular, Family, and Lifetime members earn vouchers.
          Applicants' hours are kept and shown as <em>pending</em> vouchers, which become earned once they're voted
          in. Associates, Inactive, Nonmembers, and anyone not in the members list earn none. Dues status is not checked.
        </li>
        <li>
          <strong>Service vouchers</strong> come from <em>credited</em> hours (Maintenance and Trial Setup/Teardown
          logs already count double). Under {{ SERVICE_VOUCHER_MIN_HOURS }} credited hours = 0 vouchers.
          At {{ SERVICE_VOUCHER_MIN_HOURS }}+ hours = 1 voucher per {{ SERVICE_VOUCHER_HOURS_EACH }} hours, rounded down.
          <span class="example">e.g. 49.9 hrs → 0 · 50 hrs → 2 · 74.9 hrs → 2 · 75 hrs → 3 · 100 hrs → 4</span>
        </li>
        <li>
          <strong>Blue Ribbon vouchers</strong> come from <em>actual clock</em> hours (not doubled) on Cleaning / Maintenance
          logs only: 1 voucher per full {{ BLUE_VOUCHER_HOURS_EACH }} clock hours, rounded down.
          Trial Setup/Teardown does not earn Blue Ribbon vouchers.
          <span class="example">e.g. 7.9 hrs → 0 · 8 hrs → 1 · 15.9 hrs → 1 · 16 hrs → 2</span>
        </li>
        <li>
          <strong>Cleaning counts toward both:</strong> a Maintenance log adds double credited hours toward service vouchers
          <em>and</em> its clock hours toward Blue Ribbon vouchers.
          <span class="example">e.g. 10 hrs of cleaning = 20 credited hrs + 10 Blue Ribbon hrs (1 Blue Ribbon voucher)</span>
        </li>
      </ol>
      <p class="confirm-note">
        Note: eligibility uses each person's type <em>today</em>. A member who was Regular during {{ fyName(fyStartYear) }}
        but is Inactive now shows no vouchers for that year.
      </p>
    </details>

    <div v-if="loading" class="loading">Loading logs...</div>

    <template v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">{{ totals.service }}</div>
          <div class="stat-label">Service vouchers</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-number">{{ totals.blue }}</div>
          <div class="stat-label">Blue Ribbon vouchers</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ totals.earners }}</div>
          <div class="stat-label">Members earning any</div>
        </div>
        <div class="stat-card pending">
          <div class="stat-number">{{ totals.pendingService }} + {{ totals.pendingBlue }}</div>
          <div class="stat-label">Pending service + Blue Ribbon ({{ totals.pendingPeople }} applicants)</div>
        </div>
        <div class="stat-card muted">
          <div class="stat-number">{{ totals.logged }}</div>
          <div class="stat-label">Members with hours logged</div>
        </div>
      </div>

      <!-- Voucher cards: the tracked, printable vouchers -->
      <section class="cards-panel">
        <div class="cards-head">
          <h2>Voucher cards · {{ fyName(fyStartYear) }}</h2>
          <RouterLink :to="{ name: 'voucher-print' }" class="btn-secondary">🖨️ Print cards</RouterLink>
        </div>
        <p v-if="vouchersStore.error" class="error">{{ vouchersStore.error }}</p>

        <div class="ledger-grid">
          <div v-for="t in ['class', 'blue']" :key="t" class="ledger-card" :class="t">
            <div class="ledger-title">{{ VOUCHER_TYPES[t].label }}s</div>
            <div class="ledger-counts">
              <span><strong>{{ ledger[t].total }}</strong> cards</span>
              <span>{{ ledger[t].created }} not printed</span>
              <span>{{ ledger[t].printed }} printed</span>
              <span>{{ ledger[t].handed_out }} handed out</span>
              <span>{{ ledger[t].used }} used</span>
            </div>
          </div>
        </div>

        <div class="cards-actions">
          <button class="btn-primary" :disabled="missingCards.total === 0 || creating" @click="createEarnedCards">
            {{ creating ? 'Creating...' : `Create cards for earned vouchers (${missingCards.class} service + ${missingCards.blue} Blue Ribbon missing)` }}
          </button>
          <span class="hint">Safe to run again - only adds cards that are missing (e.g. after an applicant is voted in).</span>
        </div>

        <details class="issue-box">
          <summary>➕ Issue trial vouchers (secretary, chair, and other trial workers)</summary>
          <TrialVoucherIssuer :fiscal-year-options="fiscalYearOptions" :default-fiscal-year="currentFyStart" />
        </details>

        <details class="issue-box">
          <summary>➕ Issue instructor vouchers + hours (registrar's session list)</summary>
          <InstructorVoucherIssuer />
        </details>

        <div v-if="manualSets.length" class="sets">
          <h3>Issued by hand · {{ fyName(fyStartYear) }}</h3>
          <div v-for="s in manualSets" :key="s.key" class="set">
            <div class="set-head">
              <strong>{{ s.label }}</strong>
              <span class="small">{{ statusSummary(s.vouchers) }}</span>
              <button v-if="s.vouchers.every(v => v.status === 'created')" class="btn-link danger" @click="deleteSet(s)">
                Delete set
              </button>
            </div>
            <table class="manual-table">
              <tbody>
                <tr v-for="g in s.rows" :key="g.key">
                  <td>{{ g.role }}</td>
                  <td>{{ g.memberName || "(write-in name)" }}</td>
                  <td>{{ VOUCHER_TYPES[g.type].short }}</td>
                  <td class="num">{{ g.vouchers.length }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div class="toolbar">
        <input v-model="search" type="search" class="search" placeholder="Search name or email">
        <label class="toggle">
          <input v-model="earnersOnly" type="checkbox">
          Only earned or pending vouchers
        </label>
        <button class="btn-export" :disabled="rows.length === 0" @click="exportCsv">⬇️ Export CSV</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="sortable" @click="setSort('name')">Member{{ sortMark('name') }}</th>
              <th class="num sortable" @click="setSort('creditedHours')">Credited hrs{{ sortMark('creditedHours') }}</th>
              <th class="num sortable" @click="setSort('serviceVouchers')">Service{{ sortMark('serviceVouchers') }}</th>
              <th class="num sortable" @click="setSort('cleaningClockHours')">Cleaning clock hrs{{ sortMark('cleaningClockHours') }}</th>
              <th class="num sortable" @click="setSort('blueVouchers')">Blue Ribbon{{ sortMark('blueVouchers') }}</th>
              <th>Cards</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="rows.length === 0">
              <td colspan="6" class="empty">No members match.</td>
            </tr>
            <tr v-for="r in rows" :key="r.email">
              <td>
                <div class="name">{{ r.name }}</div>
                <div class="meta">
                  <span v-if="r.type" class="type">{{ r.type }}</span>
                  <span v-if="r.eligibility === 'pending'" class="badge badge-pending">Pending vote-in</span>
                  <span v-else-if="r.eligibility === 'none'" class="badge badge-none">Not eligible</span>
                  <span v-if="!r.isMember" class="warn">not in members list</span>
                  <span v-else class="email">{{ r.email }}</span>
                </div>
              </td>
              <td class="num">{{ fmt(r.creditedHours) }}</td>
              <td class="num strong" :class="{ dim: r.eligibility !== 'earns' }">{{ voucherCell(r, 'serviceVouchers') }}</td>
              <td class="num">{{ fmt(r.cleaningClockHours) }}</td>
              <td class="num strong blue-text" :class="{ dim: r.eligibility !== 'earns' }">{{ voucherCell(r, 'blueVouchers') }}</td>
              <td class="cards-cell">
                <template v-if="memberCards(r.email).length">
                  <div class="small">{{ statusSummary(memberCards(r.email)) }}</div>
                  <button
                    v-if="memberCards(r.email).some(v => v.status === 'printed')"
                    class="btn-link"
                    @click="markHandedOut(r)"
                  >✓ Mark handed out</button>
                </template>
                <span v-else class="small dim">—</span>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="rows.length > 0">
            <tr>
              <td>Earned total ({{ rows.length }} shown; pending not included)</td>
              <td class="num">{{ fmt(sum('creditedHours')) }}</td>
              <td class="num strong">{{ sumEarned('serviceVouchers') }}</td>
              <td class="num">{{ fmt(sum('cleaningClockHours')) }}</td>
              <td class="num strong blue-text">{{ sumEarned('blueVouchers') }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Papa from 'papaparse'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'
import { useVouchersStore, VOUCHER_TYPES } from '@/stores/vouchersStore'
import TrialVoucherIssuer from './components/TrialVoucherIssuer.vue'
import InstructorVoucherIssuer from './components/InstructorVoucherIssuer.vue'
import {
  voucherTotalsByMember,
  voucherEligibility,
  SERVICE_VOUCHER_MIN_HOURS,
  SERVICE_VOUCHER_HOURS_EACH,
  BLUE_VOUCHER_HOURS_EACH
} from '@/utils/vouchers'

const membersStore = useMembersStore()
const logsStore = useLogsStore()
const vouchersStore = useVouchersStore()
const loading = ref(true)

onMounted(async () => {
  await Promise.all([membersStore.initMembers(), logsStore.initLogs(), vouchersStore.initVouchers()])
  loading.value = false
})

// Fiscal years are identified by their starting calendar year; FY26 = Oct 2025 - Sep 2026
const fyName = (startYear) => `FY${String(startYear + 1).slice(-2)}`
const today = new Date()
const currentFyStart = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1

// Default to the most recently completed fiscal year
const fyStartYear = ref(currentFyStart - 1)

const fyRangeText = computed(() => `Oct 1, ${fyStartYear.value} - Sep 30, ${fyStartYear.value + 1}`)

const fiscalYearOptions = computed(() => {
  const years = new Set([currentFyStart, currentFyStart - 1])
  logsStore.logs.forEach(log => {
    const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date)
    if (!isNaN(d)) years.add(d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1)
  })
  return [...years].sort((a, b) => b - a)
})

const allRows = computed(() => {
  const totals = voucherTotalsByMember(logsStore.logs, fyStartYear.value)
  return Object.entries(totals).map(([email, t]) => {
    const member = membersStore.getMemberByEmail(email)
    return {
      email,
      isMember: Boolean(member),
      name: member ? `${member.LastName || ''}, ${member.FirstName || ''}` : email,
      type: member?.MembershipType || '',
      eligibility: voucherEligibility(member?.MembershipType),
      ...t
    }
  })
})

// The count the hours would earn; shown as "(n)" when pending and "—" when not eligible
const voucherCell = (r, key) => {
  if (r.eligibility === 'earns') return r[key]
  if (r.eligibility === 'pending') return r[key] ? `(${r[key]})` : 0
  return '—'
}

const earnedRows = computed(() => allRows.value.filter(r => r.eligibility === 'earns'))
const pendingRows = computed(() => allRows.value.filter(r => r.eligibility === 'pending'))

const search = ref('')
const earnersOnly = ref(true)
const sortKey = ref('serviceVouchers')
const sortDesc = ref(true)

const setSort = (key) => {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else { sortKey.value = key; sortDesc.value = key !== 'name' }
}
const sortMark = (key) => sortKey.value === key ? (sortDesc.value ? ' ▼' : ' ▲') : ''

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = allRows.value.filter(r => {
    if (earnersOnly.value && (r.eligibility === 'none' || r.serviceVouchers + r.blueVouchers === 0)) return false
    return !term || r.name.toLowerCase().includes(term) || r.email.includes(term)
  })
  const dir = sortDesc.value ? -1 : 1
  return list.sort((a, b) => {
    const av = a[sortKey.value], bv = b[sortKey.value]
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return cmp * dir || a.name.localeCompare(b.name)
  })
})

const totals = computed(() => ({
  service: earnedRows.value.reduce((s, r) => s + r.serviceVouchers, 0),
  blue: earnedRows.value.reduce((s, r) => s + r.blueVouchers, 0),
  earners: earnedRows.value.filter(r => r.serviceVouchers + r.blueVouchers > 0).length,
  pendingService: pendingRows.value.reduce((s, r) => s + r.serviceVouchers, 0),
  pendingBlue: pendingRows.value.reduce((s, r) => s + r.blueVouchers, 0),
  pendingPeople: pendingRows.value.filter(r => r.serviceVouchers + r.blueVouchers > 0).length,
  logged: allRows.value.length
}))

const sum = (key) => rows.value.reduce((s, r) => s + r[key], 0)
const sumEarned = (key) => rows.value.filter(r => r.eligibility === 'earns').reduce((s, r) => s + r[key], 0)
const fmt = (n) => Math.round(n * 100) / 100

// --- Voucher cards ---

const fyVouchers = computed(() => vouchersStore.vouchers.filter(v => v.fiscalYear === fyStartYear.value))

const cardsByEmail = computed(() => {
  const map = {}
  fyVouchers.value.forEach(v => { (map[v.memberEmail] ||= []).push(v) })
  return map
})
const memberCards = (email) => cardsByEmail.value[email] || []

const ledger = computed(() => {
  const counts = { class: { total: 0, created: 0, printed: 0, handed_out: 0, used: 0 }, blue: { total: 0, created: 0, printed: 0, handed_out: 0, used: 0 } }
  fyVouchers.value.forEach(v => {
    const c = counts[v.type]
    if (!c) return
    c.total++
    c[v.status] = (c[v.status] || 0) + 1
  })
  return counts
})

const STATUS_WORDS = { created: 'not printed', printed: 'printed', handed_out: 'handed out', used: 'used' }
const statusSummary = (vouchers) => {
  const counts = {}
  vouchers.forEach(v => { counts[v.status] = (counts[v.status] || 0) + 1 })
  return `${vouchers.length} card${vouchers.length === 1 ? '' : 's'}: ` +
    Object.keys(STATUS_WORDS).filter(s => counts[s]).map(s => `${counts[s]} ${STATUS_WORDS[s]}`).join(', ')
}

// What eligible members' hours earn, as card counts
const earnedForCards = computed(() => allRows.value
  .filter(r => r.eligibility === 'earns' && r.isMember)
  .map(r => {
    const m = membersStore.getMemberByEmail(r.email)
    return {
      memberEmail: r.email,
      memberName: `${m.FirstName || ''} ${m.LastName || ''}`.trim(),
      class: r.serviceVouchers,
      blue: r.blueVouchers
    }
  }))

const missingCards = computed(() => {
  const existing = vouchersStore.countsByMember(fyStartYear.value, 'earned')
  const missing = { class: 0, blue: 0 }
  earnedForCards.value.forEach(e => {
    for (const type of ['class', 'blue']) {
      missing[type] += Math.max(0, e[type] - (existing[e.memberEmail]?.[type]?.total || 0))
    }
  })
  return { ...missing, total: missing.class + missing.blue }
})

const creating = ref(false)

const createEarnedCards = async () => {
  const { class: c, blue: b } = missingCards.value
  if (!confirm(`Create ${c} service and ${b} Blue Ribbon voucher cards for ${fyName(fyStartYear.value)}?`)) return
  creating.value = true
  try {
    const n = await vouchersStore.syncEarnedVouchers(fyStartYear.value, earnedForCards.value)
    alert(`Created ${n} voucher cards. Use "Print cards" to print them.`)
  } catch (e) {
    alert('Could not create voucher cards: ' + e.message)
  } finally {
    creating.value = false
  }
}

const markHandedOut = async (r) => {
  const printed = memberCards(r.email).filter(v => v.status === 'printed')
  try {
    await vouchersStore.setStatus(printed, 'handed_out')
  } catch (e) {
    alert('Could not update vouchers: ' + e.message)
  }
}

// Vouchers issued by hand (trial workers, instructors), grouped into their sets. Older one-off
// manual vouchers without a set fall back to grouping by their reason.
const manualSets = computed(() => {
  const sets = {}
  fyVouchers.value.filter(v => v.source === 'manual').forEach(v => {
    const setKey = v.set?.setId || `reason|${v.reason}`
    const s = (sets[setKey] ||= { key: setKey, label: v.set?.label || v.reason || 'Issued by hand', vouchers: [], rowMap: {} })
    s.vouchers.push(v)
    const role = v.set?.role || ''
    const rowKey = `${role}|${v.memberEmail}|${v.type}`
    ;(s.rowMap[rowKey] ||= { key: rowKey, role, memberName: v.memberName, type: v.type, vouchers: [] }).vouchers.push(v)
  })
  return Object.values(sets)
    .map(s => ({ ...s, rows: Object.values(s.rowMap) }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

// Only allowed while nothing in the set has been printed
const deleteSet = async (s) => {
  if (!confirm(`Delete all ${s.vouchers.length} unprinted vouchers for ${s.label}?`)) return
  try {
    for (const v of s.vouchers) await vouchersStore.deleteUnprintedVoucher(v.code)
  } catch (e) {
    alert('Could not delete: ' + e.message)
  }
}

const exportCsv = () => {
  const csv = Papa.unparse(rows.value.map(r => ({
    FiscalYear: fyName(fyStartYear.value),
    Name: r.name,
    Email: r.email,
    MembershipType: r.type,
    VoucherStatus: { earns: 'Earned', pending: 'Pending vote-in', none: 'Not eligible' }[r.eligibility],
    CreditedHours: fmt(r.creditedHours),
    ServiceVouchers: r.eligibility === 'none' ? 0 : r.serviceVouchers,
    CleaningClockHours: fmt(r.cleaningClockHours),
    BlueVouchers: r.eligibility === 'none' ? 0 : r.blueVouchers
  })))
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `vouchers_${fyName(fyStartYear.value)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.vouchers-view {
  max-width: 1000px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.page-header h1 { margin: 0; font-size: 1.75rem; font-weight: 800; }
.subtitle { margin: 0.25rem 0 0; color: #6b7280; }

.fy-select { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; font-weight: 700; color: #6b7280; text-transform: uppercase; }
.fy-select select { padding: 0.45rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 1rem; font-weight: 600; color: #111827; }

/* --- Rules --- */
.rules {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 0.6rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}
.rules summary { font-weight: 700; cursor: pointer; color: #92400e; }
.rules ol { margin: 0.75rem 0 0.5rem; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
.example { display: block; color: #6b7280; font-size: 0.85rem; margin-top: 0.15rem; }
.confirm-note { margin: 0.5rem 0 0; font-size: 0.85rem; color: #92400e; font-style: italic; }

.loading { color: #6b7280; font-style: italic; }

/* --- Stats --- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-left: 4px solid #4f46e5;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}
.stat-card.blue { border-left-color: #2563eb; }
.stat-card.muted { border-left-color: #9ca3af; }
.stat-card.pending { border-left-color: #d97706; }

.badge { font-size: 0.68rem; font-weight: 700; padding: 0 0.4rem; border-radius: 999px; }
.badge-pending { background: #fef3c7; color: #92400e; }
.badge-none { background: #f3f4f6; color: #6b7280; }
.dim { color: #9ca3af !important; font-weight: 500; }
.stat-number { font-size: 1.75rem; font-weight: 800; }
.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 600; }

/* --- Voucher cards panel --- */
.cards-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.6rem;
  padding: 1rem;
  margin-bottom: 1.25rem;
}
.cards-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.cards-head h2 { margin: 0; font-size: 1.1rem; }
.error { color: #b91c1c; font-weight: 600; font-size: 0.9rem; }

.ledger-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75rem; margin: 0.75rem 0; }
.ledger-card { border: 1px solid #e5e7eb; border-left: 4px solid #4f46e5; border-radius: 0.5rem; padding: 0.6rem 0.8rem; }
.ledger-card.blue { border-left-color: #2563eb; }
.ledger-title { font-weight: 700; margin-bottom: 0.25rem; }
.ledger-counts { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; font-size: 0.85rem; color: #374151; }

.cards-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.hint { font-size: 0.8rem; color: #6b7280; }

.btn-primary { background: #4f46e5; color: white; border: none; padding: 0.5rem 0.9rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { background: #a5b4fc; cursor: not-allowed; }
.btn-secondary { border: 1px solid #cbd5e1; background: white; color: #1f2937; padding: 0.45rem 0.8rem; border-radius: 0.375rem; font-weight: 600; text-decoration: none; font-size: 0.9rem; }
.btn-link { background: none; border: none; color: #4f46e5; font-weight: 600; cursor: pointer; padding: 0; font-size: 0.8rem; }
.btn-link.danger { color: #b91c1c; }

.issue-box { margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 0.75rem; }
.issue-box summary { font-weight: 600; cursor: pointer; }
.manual-table { margin-top: 0.4rem; font-size: 0.85rem; }

.sets { margin-top: 1rem; }
.sets h3 { font-size: 0.85rem; text-transform: uppercase; color: #6b7280; margin: 0 0 0.5rem; }
.set { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.6rem 0.75rem; margin-bottom: 0.6rem; }
.set-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.75rem; }

.small { font-size: 0.78rem; color: #4b5563; }
.cards-cell { min-width: 150px; }

/* --- Toolbar --- */
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
.search { flex: 1; min-width: 200px; padding: 0.5rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; }
.toggle { display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; cursor: pointer; }
.btn-export { background: #4f46e5; color: white; border: none; padding: 0.5rem 0.9rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; }
.btn-export:disabled { background: #a5b4fc; cursor: not-allowed; }

/* --- Table --- */
.table-wrap { background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f1f5f9; text-align: left; }
th { font-size: 0.72rem; text-transform: uppercase; color: #6b7280; background: #f9fafb; white-space: nowrap; }
.sortable { cursor: pointer; user-select: none; }
.num { text-align: right; }
.strong { font-weight: 700; }
.blue-text { color: #1d4ed8; }
.name { font-weight: 600; }
.meta { display: flex; gap: 0.5rem; font-size: 0.75rem; color: #6b7280; }
.type { font-weight: 700; text-transform: uppercase; }
.warn { color: #b45309; font-weight: 600; }
.email { word-break: break-all; }
.empty { text-align: center; color: #6b7280; font-style: italic; }
tfoot td { font-weight: 700; background: #f9fafb; border-top: 2px solid #e5e7eb; }
</style>
