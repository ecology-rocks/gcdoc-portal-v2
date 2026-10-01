<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const store = useMembersStore()
const logsStore = useLogsStore()
const logType = logsStore.logType
const search = ref('')
const selectedType = ref('')
const unpaidDuesOnly = ref(false)
const minHours = ref('')
const maxHours = ref('')
const copiedEmail = ref(null)
const printData = ref(null)
const showReportModal = ref(false)

// --- Add Missing Hours ---
const addHoursTarget = ref(null)
const addHoursForm = reactive({
  Date: new Date().toISOString().split('T')[0],
  Activity: '',
  type: logType('STANDARD'),
  clockHours: ''
})

// --- Edit Hours (inside View Report) ---
const editingReportLogId = ref(null)
const editReportForm = reactive({ Activity: '', Hours: 0, type: logType('STANDARD'), Sport: '' })

onMounted(async () => {
    await Promise.all([
        store.initMembers(),
        logsStore.initLogs()
    ])
})

const formatDate = (val) => {
  if (!val) return ''
  const d = val.toDate ? val.toDate() : new Date(val)
  return d.toLocaleDateString()
}

// yearsAgo = 0 for the current FY, 1 for the prior FY, etc.
const getFiscalYearBounds = (yearsAgo = 0) => {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const startYear = (currentMonth >= 9 ? currentYear : currentYear - 1) - yearsAgo
  return {
    startYear,
    startDate: new Date(startYear, 9, 1),
    endDate: new Date(startYear + 1, 9, 1),
    label: `Oct 1, ${startYear} - Sep 30, ${startYear + 1}`
  }
}

const getClockHoursForLog = (log) => {
  const rawClock = Number(log.clockHours)
  if (!Number.isNaN(rawClock) && rawClock > 0) return rawClock
  const credited = Number(log.Hours) || 0
  const type = log.type || ''
  if (type.includes('Cleaning / Maintenance') || type.includes('Trial Setup')) return credited / 2
  return credited
}

const getFYHoursForRange = (email, startDate, endDate) => {
  if (!email) return 0
  const normalizedEmail = email.toLowerCase()
  const hrs = logsStore.logs.reduce((sum, log) => {
    if (log.MemberEmail?.toLowerCase() !== normalizedEmail) return sum
    const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date)
    if (d >= startDate && d < endDate) return sum + (Number(log.Hours) || 0)
    return sum
  }, 0)
  return Math.round(hrs * 100) / 100
}

const getLastYearFYHours = (email) => {
  const bounds = getFiscalYearBounds(1)
  return getFYHoursForRange(email, bounds.startDate, bounds.endDate)
}

const reportFYOffset = ref(0)

const generateReportData = (member, yearsAgo = 0) => {
  const email = member.Email.toLowerCase()
  const { startYear, startDate, endDate, label } = getFiscalYearBounds(yearsAgo)

  // Filter and sort logs for this specific member in the selected FY
  const memberLogs = logsStore.logs.filter(log => {
    if (!log.MemberEmail || log.MemberEmail.toLowerCase() !== email) return false
    const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date)
    return d >= startDate && d < endDate
  }).sort((a, b) => {
    const dateA = a.Date?.toDate ? a.Date.toDate() : new Date(a.Date)
    const dateB = b.Date?.toDate ? b.Date.toDate() : new Date(b.Date)
    return dateA - dateB // Chronological order
  })

  const totalHrs = memberLogs.reduce((sum, l) => sum + (Number(l.Hours) || 0), 0)
  const stdVouchers = totalHrs >= 50 ? Math.floor(totalHrs / 25) : 0
  const blueHours = memberLogs
    .filter(l => (l.type || '').includes('Cleaning / Maintenance'))
    .reduce((sum, l) => sum + getClockHoursForLog(l), 0)
  const blueVouchers = Math.round(blueHours / 8)

  reportFYOffset.value = yearsAgo
  printData.value = {
    member,
    startYear,
    fyString: label,
    logs: memberLogs,
    totalHrs: Math.round(totalHrs * 100) / 100,
    stdVouchers,
    blueVouchers
  }
}

const viewMemberReport = (member) => {
  generateReportData(member, 0)
  showReportModal.value = true
}

const changeReportFY = (yearsAgo) => {
  if (!printData.value?.member) return
  generateReportData(printData.value.member, Number(yearsAgo))
}

const printMemberReport = async (member, yearsAgo = 0) => {
  generateReportData(member, yearsAgo)
  // Wait for Vue to render the hidden print container
  await nextTick()
  window.print()
}

const closeReportModal = () => {
  showReportModal.value = false
  // Optional: clear data, but harmless to leave it
}

const uniqueTypes = computed(() => {
    const types = store.members.map(m => m.MembershipType).filter(Boolean)
    return [...new Set(types)].sort()
})

/* Replace the filteredMembers computed property */
const filteredMembers = computed(() => {
    let list = store.members
    
    if (selectedType.value) {
        list = list.filter(m => m.MembershipType === selectedType.value)
    }
    
    if (search.value) {
        const q = search.value.toLowerCase()
        list = list.filter(m =>
            m.LastName?.toLowerCase().includes(q) ||
            m.FirstName?.toLowerCase().includes(q) ||
            m.Email?.toLowerCase().includes(q)
        )
    }

    if (unpaidDuesOnly.value) {
        list = list.filter(m => !m.Dues2026Paid)
    }

    if (minHours.value !== '' && minHours.value !== null) {
        list = list.filter(m => getFYHours(m.Email) >= Number(minHours.value))
    }

    if (maxHours.value !== '' && maxHours.value !== null) {
        list = list.filter(m => getFYHours(m.Email) <= Number(maxHours.value))
    }

    return list.sort((a, b) => {
        const nameA = (a.LastName || '').toLowerCase()
        const nameB = (b.LastName || '').toLowerCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
    })
})

const getFYHours = (email) => {
    if (!email) return 0
    const hrs = logsStore.fiscalYearHours[email.toLowerCase()] || 0
    return Math.round(hrs * 100) / 100
}

// Reflects whatever filters are currently applied, so this doubles as a quick report
// (e.g. filter to Regular members, or search a name, and the counts update to match).
const duesSummary = computed(() => {
    const paid = filteredMembers.value.filter(m => m.Dues2026Paid).length
    const total = filteredMembers.value.length
    return { paid, outstanding: total - paid, total }
})

const toggleDuesPaid = async (member) => {
  try {
    await store.setDuesPaid(member.Email, !member.Dues2026Paid)
  } catch (err) {
    console.error('Failed to update dues status', err)
    alert('Failed to update dues status.')
  }
}

// --- Add Missing Hours ---
const openAddHours = (member) => {
  addHoursTarget.value = member
  addHoursForm.Date = new Date().toISOString().split('T')[0]
  addHoursForm.Activity = ''
  addHoursForm.type = logType('STANDARD')
  addHoursForm.clockHours = ''
}

const closeAddHours = () => {
  addHoursTarget.value = null
}

const addHoursCredited = computed(() => {
  const base = parseFloat(addHoursForm.clockHours) || 0
  const multiplier = (addHoursForm.type === logType('MAINT') || addHoursForm.type === logType('SETUP')) ? 2 : 1
  return base * multiplier
})

const submitAddHours = async () => {
  const member = addHoursTarget.value
  if (!member) return
  if (!addHoursForm.Activity) return alert('Please enter an activity description.')
  const clockHours = parseFloat(addHoursForm.clockHours)
  if (!clockHours || clockHours <= 0) return alert('Please enter valid hours.')

  try {
    await logsStore.addLog({
      MemberEmail: member.Email,
      MemberName: `${member.LastName}, ${member.FirstName}`,
      Date: addHoursForm.Date,
      Activity: addHoursForm.Activity,
      type: addHoursForm.type,
      clockHours,
      Hours: addHoursCredited.value,
      Status: 'approved',
      SourceSheet: ''
    })
    closeAddHours()
    // If the report for this member is open, refresh it (keeping whichever FY is selected) so the new entry shows up right away.
    if (printData.value?.member?.Email === member.Email) generateReportData(member, reportFYOffset.value)
  } catch (err) {
    console.error('Failed to add hours', err)
    alert('Failed to add hours.')
  }
}

// --- Edit Hours (inside View Report) ---
const openEditReportLog = (log) => {
  editingReportLogId.value = log.id
  editReportForm.Activity = log.Activity
  editReportForm.Hours = log.clockHours || log.Hours
  editReportForm.type = log.type || logType('STANDARD')
  editReportForm.Sport = log.Sport || ''
}

const cancelEditReportLog = () => {
  editingReportLogId.value = null
}

const saveEditReportLog = async () => {
  const multiplier = (editReportForm.type === logType('MAINT') || editReportForm.type === logType('SETUP')) ? 2 : 1
  const enteredHours = parseFloat(editReportForm.Hours) || 0
  const creditedHours = enteredHours * multiplier

  try {
    await logsStore.updateLog(editingReportLogId.value, {
      Activity: editReportForm.Activity,
      Hours: creditedHours,
      clockHours: enteredHours,
      type: editReportForm.type,
      Sport: editReportForm.Sport
    })
    editingReportLogId.value = null
    // Refresh the open report so the table reflects the change immediately.
    if (printData.value?.member) generateReportData(printData.value.member, reportFYOffset.value)
  } catch (err) {
    console.error('Failed to save log edit', err)
    alert('Failed to save changes.')
  }
}

const copyEmail = async (email) => {
  if (!email) return
  try {
    await navigator.clipboard.writeText(email)
    copiedEmail.value = email
    setTimeout(() => { copiedEmail.value = null }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}
</script>

<template>
    <div class="manager-layout">
        <div class="manager-header">
            <div>
                <h1>Members</h1>
                <p class="subtitle">{{ filteredMembers.length }} active records found</p>
            </div>
            <div class="actions-wrapper">
                <div class="actions">
                    <input
                      v-model="search"
                      type="text"
                      placeholder="Search members..."
                      class="search-input"
                    >
                    <select v-model="selectedType" class="filter-select">
                        <option value="">All Types</option>
                        <option v-for="type in uniqueTypes" :key="type" :value="type">{{ type }}</option>
                    </select>
                    <div class="hours-filter">
                        <input type="number" v-model="minHours" placeholder="Min hrs" class="hours-input">
                        <span>&ndash;</span>
                        <input type="number" v-model="maxHours" placeholder="Max hrs" class="hours-input">
                    </div>
                    <label class="dues-filter">
                        <input type="checkbox" v-model="unpaidDuesOnly">
                        2026 Dues Unpaid Only
                    </label>
                    <button @click="$router.push('/members/add')" class="btn-add">
                        <span>+</span> Add Member
                    </button>
                </div>
            </div>
        </div>

        <div class="dues-summary-bar">
            <div class="dues-stat">
                <span class="dues-stat-value dues-stat-paid">{{ duesSummary.paid }}</span>
                <span class="dues-stat-label">Paid</span>
            </div>
            <div class="dues-stat">
                <span class="dues-stat-value dues-stat-outstanding">{{ duesSummary.outstanding }}</span>
                <span class="dues-stat-label">Outstanding</span>
            </div>
            <div class="dues-stat">
                <span class="dues-stat-value">{{ duesSummary.total }}</span>
                <span class="dues-stat-label">Total{{ (search || selectedType || unpaidDuesOnly || minHours !== '' || maxHours !== '') ? ' (filtered)' : '' }}</span>
            </div>
        </div>

        <div class="members-grid">
            <div v-for="m in filteredMembers" :key="m.id" class="member-card">
                <div class="card-header">
                    <div>
                        <div class="primary-text">{{ m.LastName }}, {{ m.FirstName }}</div>
                        <div v-if="m.FirstName2" class="secondary-text">
                          & {{ m.FirstName2 }} {{ m.LastName2 }}
                        </div>
                    </div>
                    <span class="badge badge-blue">{{ m.MembershipType }}</span>
                </div>

                <div class="card-body">
                    <button @click="copyEmail(m.Email)" class="btn-copy" :title="'Copy ' + m.Email">
                        <span class="email-text">{{ m.Email }}</span>
                        <span class="copy-icon">{{ copiedEmail === m.Email ? 'Copied!' : '📋' }}</span>
                    </button>
                    <div class="secondary-text">{{ m.Phone1 }}</div>
                    <div class="hours-text">FY Hours: <strong>{{ getFYHours(m.Email) }}</strong></div>
                    <div class="hours-text">Last Year FY Hours: <strong>{{ getLastYearFYHours(m.Email) }}</strong></div>
                    <div v-if="m.VotedInDate" class="secondary-text">Voted In: {{ m.VotedInDate }}</div>
                    <button
                        @click="toggleDuesPaid(m)"
                        class="dues-badge"
                        :class="m.Dues2026Paid ? 'dues-paid' : 'dues-unpaid'"
                    >
                        2026 Dues: {{ m.Dues2026Paid ? 'Paid' : 'Not Paid' }}
                    </button>
                </div>

                <div class="card-footer">
                    <button @click="viewMemberReport(m)" class="btn-link text-gray">
                        👁️ View Report
                    </button>
                    <button @click="printMemberReport(m)" class="btn-link text-gray">
                        🖨️ Print
                    </button>
                    <button @click="openAddHours(m)" class="btn-link text-gray">
                        ➕ Add Hours
                    </button>
                    <button @click="$router.push(`/members/edit/${m.Email}`)" class="btn-link">
                        Edit
                    </button>
                </div>
            </div>
            
            <div v-if="filteredMembers.length === 0" class="empty-state">
                No members found matching your search or filter.
            </div>
        </div>


        <div v-if="printData" class="print-container">
            <div class="print-header">
                <h1>Volunteer Hours Report</h1>
                <h2>{{ printData.member.FirstName }} {{ printData.member.LastName }}</h2>
                <p>Fiscal Year: {{ printData.fyString }}</p>
            </div>

            <div class="print-summary">
                <div class="summary-box">
                    <div class="summary-value">{{ printData.totalHrs }}</div>
                    <div class="summary-label">Total FY Hours</div>
                </div>
                <div class="summary-box">
                    <div class="summary-value">{{ printData.stdVouchers }}</div>
                    <div class="summary-label">Standard Vouchers</div>
                </div>
                <div class="summary-box">
                    <div class="summary-value">{{ printData.blueVouchers }}</div>
                    <div class="summary-label">Blue Vouchers</div>
                </div>
            </div>

            <table class="print-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Activity</th>
                        <th>Type</th>
                        <th class="text-right">Hours</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="log in printData.logs" :key="log.id">
                        <td>{{ formatDate(log.Date) }}</td>
                        <td>{{ log.Activity }}</td>
                        <td>{{ log.type }}</td>
                        <td class="text-right">{{ log.Hours }}</td>
                    </tr>
                    <tr v-if="printData.logs.length === 0">
                        <td colspan="4" class="text-center">No hours logged this fiscal year.</td>
                    </tr>
                </tbody>
            </table>
        </div>


        <div v-if="showReportModal && printData" class="modal-overlay">
          <div class="modal-container">
            <div class="modal-header">
              <h2>Volunteer Hours Report</h2>
              <button @click="closeReportModal" class="close-btn">✕</button>
            </div>
            
            <div class="modal-body">
              <div class="report-header">
                <h3>{{ printData.member.FirstName }} {{ printData.member.LastName }}</h3>
                <p>Fiscal Year: {{ printData.fyString }}</p>
                <select :value="reportFYOffset" @change="changeReportFY($event.target.value)" class="fy-select">
                  <option value="0">This Year</option>
                  <option value="1">Last Year</option>
                </select>
              </div>

              <div class="report-summary">
                <div class="summary-box">
                  <div class="summary-value">{{ printData.totalHrs }}</div>
                  <div class="summary-label">Total FY Hours</div>
                </div>
                <div class="summary-box">
                  <div class="summary-value">{{ printData.stdVouchers }}</div>
                  <div class="summary-label">Standard Vouchers</div>
                </div>
                <div class="summary-box">
                  <div class="summary-value">{{ printData.blueVouchers }}</div>
                  <div class="summary-label">Blue Vouchers</div>
                </div>
              </div>

              <table class="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Activity</th>
                    <th>Type</th>
                    <th class="text-right">Hours</th>
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="log in printData.logs" :key="log.id">
                    <tr v-if="editingReportLogId !== log.id">
                      <td>{{ formatDate(log.Date) }}</td>
                      <td>{{ log.Activity }}</td>
                      <td>{{ log.type }}</td>
                      <td class="text-right font-bold">{{ log.Hours }}</td>
                      <td class="text-right">
                        <button @click="openEditReportLog(log)" class="btn-icon" title="Edit">✏️</button>
                      </td>
                    </tr>
                    <tr v-else class="edit-row">
                      <td>{{ formatDate(log.Date) }}</td>
                      <td><input v-model="editReportForm.Activity" class="form-input-sm"></td>
                      <td>
                        <select v-model="editReportForm.type" class="form-input-sm">
                          <option :value="logType('STANDARD')">Standard</option>
                          <option :value="logType('MAINT')">Maintenance</option>
                          <option :value="logType('SETUP')">Trial Setup</option>
                        </select>
                      </td>
                      <td class="text-right">
                        <input v-model.number="editReportForm.Hours" type="number" step="0.25" class="form-input-sm hours-input-sm">
                      </td>
                      <td class="text-right actions-nowrap">
                        <button @click="saveEditReportLog" class="btn-icon" title="Save">✅</button>
                        <button @click="cancelEditReportLog" class="btn-icon" title="Cancel">✕</button>
                      </td>
                    </tr>
                  </template>
                  <tr v-if="printData.logs.length === 0">
                    <td colspan="5" class="empty-state p-4">No hours logged this fiscal year.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="modal-footer">
              <button @click="closeReportModal" class="btn-cancel">Close</button>
              <button @click="openAddHours(printData.member)" class="btn-primary">
                ➕ Add Hours
              </button>
              <button @click="printMemberReport(printData.member, reportFYOffset)" class="btn-primary">
                🖨️ Print Report
              </button>
            </div>
          </div>
        </div>

        <div v-if="addHoursTarget" class="modal-overlay">
          <div class="modal-container modal-container-sm">
            <div class="modal-header">
              <h2>Add Hours</h2>
              <button @click="closeAddHours" class="close-btn">✕</button>
            </div>

            <div class="modal-body">
              <p class="add-hours-name">{{ addHoursTarget.LastName }}, {{ addHoursTarget.FirstName }}</p>

              <div class="form-group">
                <label>Date</label>
                <input v-model="addHoursForm.Date" type="date" class="form-input">
              </div>

              <div class="form-group">
                <label>Activity Description</label>
                <input v-model="addHoursForm.Activity" type="text" class="form-input" placeholder="e.g. Mowing field, Agility trial setup">
              </div>

              <div class="form-row">
                <div class="col">
                  <label>Type</label>
                  <select v-model="addHoursForm.type" class="form-input">
                    <option :value="logType('STANDARD')">Standard / Regular (1x)</option>
                    <option :value="logType('MAINT')">Cleaning / Maintenance (2x)</option>
                    <option :value="logType('SETUP')">Trial Setup / Teardown (2x)</option>
                  </select>
                </div>
                <div class="col">
                  <label>Clock Hours</label>
                  <input v-model.number="addHoursForm.clockHours" type="number" step="0.25" min="0" class="form-input" placeholder="Actual time">
                </div>
              </div>

              <p class="add-hours-credit">Credited hours: <strong>{{ addHoursCredited }}</strong></p>
            </div>

            <div class="modal-footer">
              <button @click="closeAddHours" class="btn-cancel">Cancel</button>
              <button @click="submitAddHours" class="btn-primary">Save Entry</button>
            </div>
          </div>
        </div>

    </div>
</template>

<style scoped>
.manager-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}
.manager-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .manager-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.actions-wrapper {
  width: 100%;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

@media (min-width: 768px) {
  .actions-wrapper { width: auto; }
  .actions {
    flex-direction: row;
    align-items: center;
  }
}

.filter-select, .search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  width: 100%;
  box-sizing: border-box;
  background-color: white;
}

@media (min-width: 768px) {
  .filter-select, .search-input { width: auto; }
}

.btn-add {
  background-color: #4f46e5;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.btn-add:hover { background-color: #4338ca; }

.dues-filter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: #374151;
  white-space: nowrap;
}

.hours-filter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.hours-input {
  width: 70px;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.dues-badge {
  margin-top: 0.5rem;
  display: inline-block;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.dues-paid {
  background-color: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.dues-unpaid {
  background-color: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.dues-summary-bar {
  display: flex;
  gap: 1.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
}

.dues-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.dues-stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #111827;
}

.dues-stat-paid { color: #15803d; }
.dues-stat-outstanding { color: #b91c1c; }

.dues-stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 0.25rem;
  text-align: center;
}

/* Grid / Card Layout */
.members-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  overflow-y: auto;
  flex: 1;
  padding-bottom: 1rem;
}

@media (min-width: 640px) {
  .members-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .members-grid { grid-template-columns: repeat(3, 1fr); }
}

.member-card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.card-body {
  margin-bottom: 1rem;
  flex: 1;
}

/* --- Updated Card Footer --- */
.card-footer {
  border-top: 1px solid #f3f4f6;
  padding-top: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.text-gray { color: #6b7280; }
.text-gray:hover { color: #374151; }

/* --- Print Container Styles --- */
.print-container {
  display: none; /* Hidden on normal screen views */
}

@media print {
  /* Hide the normal dashboard UI */
  .manager-header, .members-grid, .modal-overlay {
    display: none !important;
  }}
  
  .manager-layout {
    height: auto;
    display: block;
  }
  
  /* Show and style the print container */
  .print-container {
    display: block !important;
    padding: 0;
    color: black;
  }
  
  .print-header { text-align: center; margin-bottom: 2rem; }
  .print-header h1 { font-size: 1.5rem; margin: 0; }
  .print-header h2 { font-size: 1.25rem; margin: 0.25rem 0; color: #374151; }
  
  .print-summary { 
    display: flex; 
    justify-content: space-around; 
    margin-bottom: 2rem; 
    border: 2px solid #cbd5e1; 
    padding: 1rem; 
    border-radius: 0.5rem; 
  }
  
  .summary-box { text-align: center; }
  .summary-value { font-size: 1.5rem; font-weight: bold; color: #111827; }
  .summary-label { font-size: 0.875rem; color: #64748b; text-transform: uppercase; font-weight: bold;}
  
  .print-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .print-table th, .print-table td { border-bottom: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }
  .print-table th { border-bottom: 2px solid #111827; font-weight: bold; color: #111827;}
  
  .text-right { text-align: right !important; }
  .text-center { text-align: center !important; }

.primary-text {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

.secondary-text {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.badge {
  display: inline-flex;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.badge-blue {
  background-color: #dbeafe;
  color: #1e40af;
}

.btn-link {
  background: none;
  border: none;
  color: #4f46e5;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-link:hover {
  color: #312e81;
}

.btn-copy {
  background: none;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: #4f46e5;
  font-size: 0.875rem;
  font-weight: 500;
}
.btn-copy:hover { color: #312e81; }

.copy-icon {
  font-size: 0.75rem;
  background-color: #f3f4f6;
  color: #374151;
  padding: 2px 6px;
  border-radius: 4px;
}

.email-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px; /* Adjust based on your preference */
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-style: italic;
  border: 2px dashed #e5e7eb;
  border-radius: 0.5rem;
}

/* --- View Report Modal Styles --- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
  backdrop-filter: blur(2px);
}

.modal-container-sm {
  max-width: 480px;
}

.add-hours-name {
  font-weight: 700;
  font-size: 1.1rem;
  color: #111827;
  margin: 0 0 1rem;
}

.add-hours-credit {
  background-color: #f9fafb;
  border: 1px dashed #d1d5db;
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #4b5563;
  margin: 0.5rem 0 0;
}

.form-input-sm {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 0.3rem 0.4rem;
  font-size: 0.8rem;
  box-sizing: border-box;
}

.hours-input-sm {
  width: 70px;
}

.edit-row { background-color: #eef2ff; }
.actions-nowrap { white-space: nowrap; }
.btn-icon { background: none; border: none; cursor: pointer; padding: 0 0.25rem; font-size: 0.95rem; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.875rem; font-weight: 700; color: #374151; margin-bottom: 0.25rem; }
.form-input {
  width: 100%;
  border: 1px solid #d1d5db;
  padding: 0.6rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  box-sizing: border-box;
}
.form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
.form-row .col { flex: 1; }

.modal-container {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #111827; }

.close-btn { background: none; border: none; font-size: 1.25rem; color: #9ca3af; cursor: pointer; }

.modal-body { padding: 1.5rem; overflow-y: auto; }

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}

.btn-cancel { background: none; border: none; color: #4b5563; padding: 0.5rem 1rem; cursor: pointer; font-weight: 500; }
.btn-primary { background-color: #4f46e5; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; }

/* Modal Content Details */
.report-header { text-align: center; margin-bottom: 1.5rem; }
.report-header h3 { font-size: 1.5rem; margin: 0 0 0.25rem 0; color: #111827; }
.report-header p { margin: 0; color: #6b7280; }
.fy-select {
  margin-top: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: white;
}

.report-summary {
  display: flex;
  justify-content: space-around;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.report-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.report-table th, .report-table td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #f1f5f9; text-align: left; }
.report-table th { background: #f8fafc; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }

.font-bold { font-weight: 700; }
.p-4 { padding: 1rem !important; }

</style>