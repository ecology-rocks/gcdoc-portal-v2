<template>
  <div class="instructor-issuer">
    <p class="intro">
      Upload the registrar's list (one row per instructor per class). Per class: {{ INSTRUCTOR_MIN_WEEKS }}+ of
      {{ INSTRUCTOR_SESSION_WEEKS }} weeks attended earns 1 Blue Ribbon voucher, and every week attended adds
      {{ INSTRUCTOR_HOURS_PER_WEEK }} service hour{{ INSTRUCTOR_HOURS_PER_WEEK === 1 ? '' : 's' }}.
      <button type="button" class="btn-link" @click="downloadTemplate">⬇️ Download blank template</button>
    </p>

    <div class="session-fields">
      <div class="field">
        <label>Session name</label>
        <input v-model="sessionName" type="text" placeholder="e.g. Session 1 2027">
      </div>
      <div class="field">
        <label>Session end date</label>
        <input v-model="sessionDate" type="date" @change="fiscalYear = sessionDate ? fiscalYearOfDate(sessionDate) : fiscalYear">
      </div>
      <div class="field narrow">
        <label>Counts toward</label>
        <select v-model.number="fiscalYear">
          <option v-for="y in fiscalYearChoices" :key="y" :value="y">{{ fyLabel(y) }}</option>
        </select>
      </div>
      <div class="field">
        <label>Registrar's CSV</label>
        <input type="file" accept=".csv" @change="parseFile">
      </div>
    </div>

    <p v-if="dateShifted" class="note-box">
      This session ended in {{ fyLabel(fiscalYearOfDate(sessionDate)) }} but counts toward {{ fyLabel(fiscalYear) }}, so the
      hours will be dated <strong>{{ logDateText }}</strong> so they count in {{ fyLabel(fiscalYear) }} with the vouchers.
    </p>
    <p v-if="parseError" class="error">{{ parseError }}</p>
    <p v-if="duplicateSession" class="warn-box">
      ⚠️ "{{ sessionName.trim() }}" has already been issued. Issuing again would duplicate vouchers and hours.
    </p>

    <template v-if="rows.length">
      <table class="review-table">
        <thead>
          <tr>
            <th></th>
            <th>Class</th>
            <th>Instructor (from file)</th>
            <th>Member</th>
            <th class="num">Weeks</th>
            <th class="num">Voucher</th>
            <th class="num">Hours</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" :class="{ excluded: !row.include, unmatched: row.include && !row.memberEmail }">
            <td><input v-model="row.include" type="checkbox" title="Include this row"></td>
            <td>{{ row.className }}</td>
            <td>{{ row.instructorName }}</td>
            <td class="member-cell">
              <MemberSelect v-model="row.memberEmail" />
              <div v-if="row.include && !row.memberEmail" class="row-note">{{ row.matchNote || 'No matching member - pick one' }}</div>
            </td>
            <td class="num">
              <span :class="{ bad: !row.weeksValid }">{{ row.weeksText }}</span>
            </td>
            <td class="num">{{ row.weeksValid && row.weeks >= INSTRUCTOR_MIN_WEEKS ? '1' : '—' }}</td>
            <td class="num">{{ row.weeksValid ? row.weeks * INSTRUCTOR_HOURS_PER_WEEK : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div v-for="t in perInstructor" :key="t.key" class="total-chip">
          <strong>{{ t.name }}</strong>: {{ t.vouchers }} voucher{{ t.vouchers === 1 ? '' : 's' }} · {{ t.hours }} hrs
        </div>
      </div>

      <div class="issue-actions">
        <span class="summary">
          {{ included.length }} rows · <strong>{{ totalVouchers }}</strong> Blue Ribbon vouchers ·
          <strong>{{ totalHours }}</strong> service hours
          <span v-if="blockers.length" class="warn"> · {{ blockers[0] }}</span>
        </span>
        <button type="button" class="btn-primary" :disabled="blockers.length > 0 || issuing" @click="issue">
          {{ issuing ? 'Issuing...' : 'Issue vouchers and hours' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Papa from 'papaparse'
import { useMembersStore } from '@/stores/membersStore'
import { useVouchersStore, fyLabel, fiscalYearOfDate, instructorLogDate } from '@/stores/vouchersStore'
import MemberSelect from '@/components/admin/MemberSelect.vue'
import { INSTRUCTOR_SESSION_WEEKS, INSTRUCTOR_MIN_WEEKS, INSTRUCTOR_HOURS_PER_WEEK } from '@/utils/vouchers'

// 'issued' after a successful issue, so a surrounding modal can close
const emit = defineEmits(['issued'])

const membersStore = useMembersStore()
const vouchersStore = useVouchersStore()

const sessionName = ref('')
const sessionDate = ref('')
const rows = ref([])

// Which fiscal year the vouchers and hours count toward. Defaults from the end date, but a late-year
// session (e.g. Session 5 2026) can be pointed at the next FY.
const today = new Date()
const currentFyStart = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1
const fiscalYear = ref(currentFyStart)
const fiscalYearChoices = [currentFyStart - 1, currentFyStart, currentFyStart + 1]

const dateShifted = computed(() => sessionDate.value && fiscalYearOfDate(sessionDate.value) !== fiscalYear.value)
const logDateText = computed(() => sessionDate.value
  ? instructorLogDate(sessionDate.value, fiscalYear.value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '')
const parseError = ref('')
const issuing = ref(false)

const TEMPLATE_HEADERS = ['Class', 'Instructor', 'Weeks Attended', 'Email (optional)']

const downloadTemplate = () => {
  const csv = Papa.unparse({ fields: TEMPLATE_HEADERS, data: [] })
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'instructor_vouchers_template.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Accept a few reasonable spellings of each column header
const findKey = (headers, patterns) => headers.find(h => patterns.some(p => p.test(h.trim())))

const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z, ]/g, '').replace(/\s+/g, ' ').trim()

// Name -> member email. Matches primary and household (second) members, "First Last" or "Last, First".
// Names that match more than one member are left for a person to pick.
const nameIndex = computed(() => {
  const index = new Map()
  const add = (first, last, email) => {
    if (!first || !last) return
    for (const key of [`${first} ${last}`, `${last}, ${first}`, `${last} ${first}`].map(normalizeName)) {
      if (!index.has(key)) index.set(key, new Set())
      index.get(key).add(email)
    }
  }
  membersStore.members.forEach(m => {
    const email = (m.Email || '').toLowerCase()
    if (!email) return
    add(m.FirstName, m.LastName, email)
    add(m.FirstName2, m.LastName2 || m.LastName, email)
  })
  return index
})

const matchMember = (name, email) => {
  const byEmail = email && membersStore.getMemberByEmail(email)
  if (byEmail) return { memberEmail: byEmail.Email.toLowerCase(), matchNote: '' }
  const found = nameIndex.value.get(normalizeName(name))
  if (!found) return { memberEmail: '', matchNote: 'No matching member - pick one' }
  if (found.size > 1) return { memberEmail: '', matchNote: 'Matches more than one member - pick one' }
  return { memberEmail: [...found][0], matchNote: '' }
}

let nextId = 0

const parseFile = (event) => {
  const file = event.target.files[0]
  parseError.value = ''
  rows.value = []
  if (!file) return

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const headers = results.meta.fields || []
      const classKey = findKey(headers, [/^class/i])
      const instructorKey = findKey(headers, [/^instructor/i, /^name$/i])
      const weeksKey = findKey(headers, [/week/i, /attended/i, /^classes/i])
      const emailKey = findKey(headers, [/email/i])
      if (!classKey || !instructorKey || !weeksKey) {
        parseError.value = `The file needs Class, Instructor, and Weeks Attended columns. Found: ${headers.join(', ') || 'none'}.`
        return
      }

      rows.value = results.data
        .filter(r => String(r[instructorKey] || '').trim())
        .map(r => {
          const weeksText = String(r[weeksKey] ?? '').trim()
          const weeks = Number(weeksText)
          const weeksValid = weeksText !== '' && Number.isInteger(weeks) && weeks >= 0 && weeks <= INSTRUCTOR_SESSION_WEEKS
          const instructorName = String(r[instructorKey]).trim()
          return {
            id: nextId++,
            include: true,
            className: String(r[classKey] || '').trim(),
            instructorName,
            weeksText: weeksText || '(blank)',
            weeks: weeksValid ? weeks : 0,
            weeksValid,
            ...matchMember(instructorName, String(r[emailKey] || '').trim())
          }
        })
      if (rows.value.length === 0) parseError.value = 'No instructor rows found in that file.'
    },
    error: (err) => { parseError.value = 'Could not read the file: ' + err.message }
  })
  event.target.value = ''
}

const included = computed(() => rows.value.filter(r => r.include))
const totalVouchers = computed(() => included.value.filter(r => r.weeksValid && r.weeks >= INSTRUCTOR_MIN_WEEKS).length)
const totalHours = computed(() => included.value.reduce((s, r) => s + (r.weeksValid ? r.weeks * INSTRUCTOR_HOURS_PER_WEEK : 0), 0))

const perInstructor = computed(() => {
  const map = {}
  included.value.forEach(r => {
    const key = r.memberEmail || r.instructorName
    const t = (map[key] ||= { key, name: r.instructorName, vouchers: 0, hours: 0 })
    if (r.weeksValid && r.weeks >= INSTRUCTOR_MIN_WEEKS) t.vouchers++
    if (r.weeksValid) t.hours += r.weeks * INSTRUCTOR_HOURS_PER_WEEK
  })
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
})

const duplicateSession = computed(() => sessionName.value.trim() && vouchersStore.instructorSessionExists(sessionName.value))

// Reasons the Issue button is disabled, first one shown
const blockers = computed(() => {
  const out = []
  if (!sessionName.value.trim()) out.push('Enter a session name')
  if (!sessionDate.value) out.push('Enter the session end date')
  if (included.value.some(r => !r.weeksValid)) out.push(`Fix weeks that aren't a whole number from 0 to ${INSTRUCTOR_SESSION_WEEKS} (or uncheck those rows)`)
  if (included.value.some(r => !r.memberEmail)) out.push('Pick a member for every highlighted row (or uncheck it)')
  if (included.value.length === 0) out.push('No rows included')
  return out
})

const issue = async () => {
  const name = sessionName.value.trim()
  if (duplicateSession.value && !confirm(`"${name}" was already issued. Issue it AGAIN? This duplicates vouchers and hours.`)) return
  if (!confirm(`Issue ${totalVouchers.value} Blue Ribbon vouchers and ${totalHours.value} service hours for ${name}, counting toward ${fyLabel(fiscalYear.value)}?`)) return

  issuing.value = true
  try {
    const result = await vouchersStore.issueInstructorSession({
      sessionName: name,
      sessionDate: sessionDate.value,
      fiscalYear: fiscalYear.value,
      rows: included.value.map(r => ({ className: r.className, instructorName: r.instructorName, memberEmail: r.memberEmail, weeks: r.weeks }))
    })
    alert(`${name}: issued ${result.voucherCount} Blue Ribbon vouchers and logged ${result.hours} service hours.`)
    rows.value = []
    sessionName.value = ''
    sessionDate.value = ''
    emit('issued')
  } catch (e) {
    alert('Could not issue: ' + e.message)
  } finally {
    issuing.value = false
  }
}
</script>

<style scoped>
.instructor-issuer { margin-top: 0.75rem; }
.intro { font-size: 0.875rem; color: #374151; margin: 0 0 0.75rem; }
.hint { font-weight: 400; color: #9ca3af; }

.session-fields { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 180px; }
.field label { font-size: 0.75rem; font-weight: 600; color: #4b5563; }
.field input { padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; }

.field.narrow { flex: 0 0 110px; min-width: 110px; }
.field select { padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; }
.note-box { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; }
.error { color: #b91c1c; font-weight: 600; font-size: 0.875rem; }
.warn-box { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 600; }

.review-table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.85rem; }
.review-table th { font-size: 0.72rem; text-transform: uppercase; color: #6b7280; text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #e5e7eb; }
.review-table td { padding: 0.3rem 0.4rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.review-table tr.unmatched td { background: #fef2f2; }
.review-table tr.excluded td { opacity: 0.45; }
.member-cell { min-width: 220px; }
.row-note { font-size: 0.75rem; color: #b91c1c; margin-top: 0.15rem; }
.num { text-align: right; }
.bad { color: #b91c1c; font-weight: 700; }

.totals { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem; }
.total-chip { background: #eff6ff; color: #1e3a8a; border-radius: 999px; padding: 0.2rem 0.6rem; font-size: 0.8rem; }

.issue-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-top: 0.75rem; }
.summary { flex: 1; font-size: 0.875rem; color: #374151; }
.warn { color: #b45309; }
.btn-primary { background: #4f46e5; color: white; border: none; padding: 0.5rem 0.9rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { background: #a5b4fc; cursor: not-allowed; }
.btn-link { background: none; border: none; color: #4f46e5; font-weight: 600; cursor: pointer; padding: 0; font-size: 0.85rem; margin-left: 0.25rem; }
</style>
