<template>
  <div class="printable-container" :class="`kind-${kind}`">
    <div class="controls no-print">
      <div class="kind-tabs">
        <RouterLink v-for="opt in kinds" :key="opt.key" :to="{ name: 'meeting-print', params: { kind: opt.key } }"
          class="kind-tab" :class="{ active: kind === opt.key }">
          {{ opt.label }}
        </RouterLink>
      </div>
      <div class="control-row">
        <label v-if="kind === 'year'" class="year-input">
          Fiscal year ending
          <input v-model.number="meetingFyEnd" type="number" min="2020" max="2100">
        </label>
        <button class="btn-print" @click="printSheet">🖨️ Print</button>
        <span v-if="loading" class="loading-msg">Loading member data...</span>
      </div>
    </div>

    <!-- 1. Year-long attendance: one sheet for every meeting this year -->
    <div v-if="kind === 'year'" class="sheet">
      <div class="sheet-header">
        <h1>GCDOC {{ fyLabel(meetingFyEnd) }} General Meeting Attendance</h1>
        <p class="voting-summary">
          Eligible voters: <strong>{{ membersStore.eligibleVoters.length }}</strong>
          <span class="of-total">(of {{ votingMembers.length }} voting members and {{ associateCount }} associate members)</span>
          · Quorum (20%): <strong>{{ membersStore.quorum }}</strong>
        </p>
        <p class="sub">As of {{ generatedDate }}</p>
      </div>
      <table class="print-table">
        <thead>
          <tr>
            <th class="col-name">Member</th>
            <th v-for="m in meetingMonths" :key="m.key" class="col-month">{{ m.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in votingMembers" :key="member.id">
            <td class="cell-name">
              <div>
                {{ member.LastName }}, {{ member.FirstName }}<span v-if="isLifetime(member)" class="marker">LT</span><span
                  v-if="!isEligibleToVote(member)" class="marker marker-ineligible">INELIGIBLE</span>
              </div>
              <div v-if="familyName(member)" class="family-line">{{ familyName(member) }}</div>
            </td>
            <td v-for="m in meetingMonths" :key="m.key" class="cell-box"></td>
          </tr>
          <tr v-for="n in BLANK_ROWS" :key="'blank' + n" class="blank-row">
            <td class="cell-name">&nbsp;</td>
            <td v-for="m in meetingMonths" :key="m.key" class="cell-box"></td>
          </tr>
        </tbody>
      </table>
      <p class="sheet-footer">{{ votingMembers.length }} members listed · Generated {{ generatedDate }}</p>
      <div class="dues-callout">
        <img v-if="duesQr" :src="duesQr" alt="QR code for the dues page" class="dues-qr">
        <div>
          <div class="dues-callout-title">Marked INELIGIBLE? Pay your dues to vote.</div>
          <div>Scan the code or visit <strong>{{ DUES_URL.replace('https://', '') }}</strong></div>
        </div>
      </div>
    </div>

    <!-- 2. Applicants: entry date and hours toward being voted in -->
    <div v-else-if="kind === 'applicants'" class="sheet">
      <div class="sheet-header">
        <h1>GCDOC Applicants</h1>
        <p class="sub">Generated {{ generatedDate }}</p>
      </div>
      <table class="print-table applicant-table">
        <thead>
          <tr>
            <th class="col-name">Applicant</th>
            <th class="col-date">Entered</th>
            <th class="col-num">FY Hours</th>
            <th class="col-num">Total Hours</th>
            <th v-for="item in APPLICANT_CHECKLIST" :key="item.field" class="col-check">{{ item.short }}</th>
            <th class="col-date">Voted In</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in applicants" :key="member.id">
            <td class="cell-name">
              <div>{{ member.LastName }}, {{ member.FirstName }}</div>
              <div v-if="familyName(member)" class="family-line">{{ familyName(member) }}</div>
            </td>
            <td class="cell-center">{{ entryDate(member) }}</td>
            <td class="cell-center">{{ hours(logsStore.fiscalYearHours, member) }}</td>
            <td class="cell-center">{{ hours(logsStore.totalHoursByMember, member) }}</td>
            <td v-for="item in APPLICANT_CHECKLIST" :key="item.field" class="cell-center cell-check">
              {{ member[item.field] ? '✓' : '' }}
            </td>
            <td class="cell-center">{{ member.VotedInDate ? formatIsoDate(member.VotedInDate) : '' }}</td>
          </tr>
          <tr v-if="applicants.length === 0">
            <td :colspan="5 + APPLICANT_CHECKLIST.length" class="empty">No applicants on file.</td>
          </tr>
        </tbody>
      </table>
      <p class="sheet-footer">{{ applicants.length }} applicants listed</p>
    </div>

    <!-- 3. Compact hours report for members to check at a meeting, two columns per page -->
    <div v-else class="sheet">
      <div class="sheet-header compact-header">
        <h1>GCDOC Member Hours Report</h1>
        <p class="sub">As of {{ generatedDate }}</p>
      </div>
      <div class="compact-legends">
        <div v-for="n in 2" :key="n" class="compact-legend">
          <span class="c-name">Member</span><span class="c-num">{{ lastFyLabel }}</span><span class="c-num">{{ thisFyLabel }}</span><span class="c-box">*</span>
        </div>
      </div>
      <div class="compact-list">
        <div v-for="member in signInMembers" :key="member.id" class="compact-row">
          <span class="c-name">
            {{ member.LastName }}, {{ member.FirstName }}<span v-if="typeMarker(member)" class="marker">{{ typeMarker(member) }}</span>
            <span v-if="familyName(member)" class="family-inline"> {{ familyName(member) }}</span>
          </span>
          <span class="c-num">{{ hours(logsStore.lastFiscalYearHours, member) }}</span>
          <span class="c-num">{{ hours(logsStore.fiscalYearHours, member) }}</span>
          <span class="c-box"><span class="checkbox"></span></span>
        </div>
      </div>
      <p class="sheet-footer">{{ signInMembers.length }} listed</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMembersStore, isEligibleToVote, APPLICANT_CHECKLIST } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'
import QRCode from 'qrcode'

const DUES_URL = 'https://gcdoc.com/2026-dues'

// Room on the year sheet to write in the 10-20 members voted in during the year
const BLANK_ROWS = 15

const route = useRoute()
const membersStore = useMembersStore()
const logsStore = useLogsStore()
const loading = ref(false)

const kinds = [
  { key: 'hours', label: 'Hours Report' },
  { key: 'year', label: 'Year Attendance' },
  { key: 'applicants', label: 'Applicants' }
]
const kind = computed(() => kinds.some(k => k.key === route.params.kind) ? route.params.kind : 'hours')

const today = new Date()
const generatedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

// Fiscal years (Oct - Sep) labeled by the year they end, e.g. FY27 = Oct 2026 - Sep 2027
const fyEndYear = today.getMonth() >= 9 ? today.getFullYear() + 1 : today.getFullYear()
const fyLabel = (endYear) => `FY${String(endYear).slice(-2)}`
const thisFyLabel = fyLabel(fyEndYear)
const lastFyLabel = fyLabel(fyEndYear - 1)

// The year sheet covers one fiscal year of meetings: November opens it, the rest fall in the
// following calendar year. Defaults to the current fiscal year.
const meetingFyEnd = ref(fyEndYear)
const meetingMonths = computed(() => [
  { key: 'nov', label: `Nov '${String(meetingFyEnd.value - 1).slice(-2)}` },
  ...['Feb', 'Apr', 'Jun', 'Sep'].map(m => ({ key: m.toLowerCase(), label: `${m} '${String(meetingFyEnd.value).slice(-2)}` }))
])

onMounted(async () => {
  loading.value = true
  await Promise.all([membersStore.initMembers(), logsStore.initLogs()])
  loading.value = false
})

const byName = (a, b) =>
  (a.LastName || '').localeCompare(b.LastName || '', undefined, { sensitivity: 'base' }) ||
  (a.FirstName || '').localeCompare(b.FirstName || '', undefined, { sensitivity: 'base' })

const votingMembers = computed(() => [...membersStore.votingMembers].sort(byName))
// Associates can't vote; counted only so the header shows the whole membership
const associateCount = computed(() =>
  membersStore.members.filter(m => (m.MembershipType || '').toLowerCase() === 'associate').length
)
const applicants = computed(() => [...membersStore.applicants].sort(byName))
const signInMembers = computed(() => [...membersStore.votingMembers, ...membersStore.applicants].sort(byName))

// "& Pat" when the family member shares the last name, otherwise "& Pat Jones"
const familyName = (m) => {
  if (!m.FirstName2) return ''
  const sameLast = !m.LastName2 || m.LastName2 === m.LastName
  return `& ${m.FirstName2}${sameLast ? '' : ' ' + m.LastName2}`
}

const isLifetime = (m) => (m.MembershipType || '').toLowerCase() === 'lifetime'

// QR code for the dues page, so INELIGIBLE members can pay on their phone at the meeting
const duesQr = ref('')
QRCode.toDataURL(DUES_URL, { margin: 1, width: 240 })
  .then(url => { duesQr.value = url })
  .catch(e => console.warn('Could not generate dues QR code', e))

const typeMarker = (m) => {
  const t = (m.MembershipType || '').toLowerCase()
  if (t === 'lifetime') return 'LT'
  if (t === 'applicant') return 'APP'
  return ''
}

const hours = (hoursMap, m) => Math.round(hoursMap[(m.Email || '').toLowerCase()] || 0)

// When the member record was created; CSV-imported members may only have a Joined year
const entryDate = (m) => {
  if (m.createdAt) {
    const d = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt)
    if (!isNaN(d)) return d.toLocaleDateString('en-US')
  }
  return m.Joined ? `${m.Joined}` : '—'
}

// 'YYYY-MM-DD' -> 'M/D/YYYY' without a timezone shift
const formatIsoDate = (iso) => {
  const [y, m, d] = String(iso).split('-')
  return d ? `${Number(m)}/${Number(d)}/${y}` : iso
}

const printSheet = () => window.print()
</script>

<style scoped>
.printable-container {
  max-width: 850px;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: Arial, Helvetica, sans-serif;
  color: #000;
}

/* --- Screen controls --- */
.controls { margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }

.kind-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.kind-tab {
  padding: 0.4rem 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  text-decoration: none;
  color: #334155;
  font-size: 0.875rem;
  font-weight: 600;
  background: white;
}
.kind-tab.active { background: #4f46e5; border-color: #4f46e5; color: white; }

.control-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

.year-input { display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; font-weight: 600; }
.year-input input { width: 5.5rem; padding: 0.3rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 4px; }

.btn-print {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.btn-print:hover { background-color: #2563eb; }

.loading-msg { color: #666; font-style: italic; }

/* --- Sheet --- */
.sheet-header {
  text-align: center;
  margin-bottom: 1rem;
  border-bottom: 2px solid #000;
  padding-bottom: 0.6rem;
}
.sheet-header h1 { margin: 0 0 0.3rem; font-size: 1.3rem; text-transform: uppercase; }
.sub { margin: 0; font-size: 0.85rem; }

.sheet-footer { margin-top: 0.75rem; font-size: 0.8rem; text-align: right; }

.voting-summary { margin: 0 0 0.2rem; font-size: 1rem; }
.of-total { font-size: 0.85em; }

.dues-callout {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 1rem;
  padding: 0.6rem 0.8rem;
  border: 2px solid #000;
  border-radius: 6px;
  font-size: 10.5pt;
  break-inside: avoid;
}
.dues-callout-title { font-weight: bold; font-size: 11.5pt; margin-bottom: 0.2rem; }
.dues-qr { width: 1.1in; height: 1.1in; flex-shrink: 0; }

/* Unpaid members can't vote: filled tag so it stands out from LT */
.marker-ineligible {
  background: #000;
  color: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Small outlined tag for member type (LT / APP), set apart from the name */
.marker {
  display: inline-block;
  margin-left: 0.4em;
  padding: 0 0.3em;
  border: 1px solid #000;
  border-radius: 3px;
  font-size: 0.7em;
  font-weight: bold;
  line-height: 1.3;
  letter-spacing: 0.03em;
  vertical-align: 0.1em;
}

/* --- Full tables (year + applicants) --- */
.print-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
.print-table th, .print-table td { border: 1px solid #000; padding: 0.25rem 0.4rem; }
.print-table th { background: #f3f3f3; text-align: left; }
.print-table tr { break-inside: avoid; }

.col-month { width: 10%; text-align: center !important; }
.col-date { width: 18%; text-align: center !important; }
.col-num { width: 14%; text-align: center !important; }

/* Applicant sheet has 10 columns - tighten so it fits portrait */
.applicant-table { font-size: 9.5pt; }
.applicant-table th { font-size: 8pt; vertical-align: bottom; }
.applicant-table .col-date { width: 10%; }
.applicant-table .col-num { width: 7%; }
.col-check { width: 6%; text-align: center !important; }
.cell-check { font-weight: bold; font-size: 1.1em; }

.family-line { font-size: 0.85em; color: #333; padding-left: 0.75rem; }
.cell-center { text-align: center; }
.blank-row td { height: 1.6rem; }
.empty { text-align: center; font-style: italic; }

/* --- Compact sign-in: two columns --- */
.compact-header { margin-bottom: 0.4rem; padding-bottom: 0.3rem; }
.compact-header h1 { font-size: 1.1rem; }

.compact-legend, .compact-row {
  display: grid;
  grid-template-columns: 1fr 2.4em 2.4em 1.6em;
  align-items: center;
  column-gap: 0.25rem;
}

/* Column headers repeated over each of the two columns */
.compact-legends { display: flex; gap: 1.2rem; margin-bottom: 0.15rem; }

.compact-legend {
  flex: 1;
  font-size: 7.5pt;
  font-weight: bold;
  text-transform: uppercase;
  border-bottom: 1px solid #000;
}

.compact-list {
  column-count: 2;
  column-gap: 1.2rem;
  column-rule: 1px solid #999;
}

.compact-row {
  font-size: 8.5pt;
  line-height: 1.25;
  padding: 0.12rem 0;
  border-bottom: 1px solid #ccc;
  break-inside: avoid;
}

.c-name { min-width: 0; overflow-wrap: anywhere; }
.family-inline { color: #444; font-size: 0.9em; }
.c-num { text-align: center; }
.c-box { text-align: center; }

.checkbox {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  border: 1px solid #000;
  vertical-align: middle;
}

/* --- Print --- */
@media print {
  @page { margin: 0.4in; size: letter; }

  .no-print { display: none !important; }

  .printable-container { padding: 0; margin: 0; max-width: none; width: 100%; }

  .print-table th { background-color: white !important; border-bottom: 2px solid #000; }
}
</style>
