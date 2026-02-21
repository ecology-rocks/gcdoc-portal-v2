<template>
  <div class="log-history">

    <div class="stats-bar">
      <div class="stat-card">
        <span class="stat-label">Logs ({{ periodLabel }})</span>
        <span class="stat-value">{{ filteredLogs.length }}</span>
      </div>
      <div class="stat-card primary">
        <span class="stat-label">Credited Hours</span>
        <span class="stat-value">{{ stats.totalHours }}</span>
      </div>
      <div class="stat-card maintenance">
        <span class="stat-label">Maintenance</span>
        <span class="stat-value">{{ stats.maintenance }}</span>
      </div>
      <div class="stat-card setup">
        <span class="stat-label">Event Setup</span>
        <span class="stat-value">{{ stats.setup }}</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-group">
        <input v-model="filters.search" type="text" placeholder="Search member or activity..."
          class="input-control search-box">
      </div>

      <div class="filter-group">

        <select v-model="filters.period" @change="applyPeriod"
          class="input-control period-select font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
          <option value="current_fy">Current FY ({{ currentFYLabel }})</option>
          <option value="last_fy">Last FY</option>
          <option value="all">All Time</option>
          <option value="custom">Custom Range</option>
        </select>

        <span class="w-px h-6 bg-gray-300 mx-2"></span>

        <select v-model="filters.type" class="input-control type-select">
          <option value="all">All Types</option>
          <option :value="logType('STANDARD')">Standard</option>
          <option :value="logType('SETUP')">Trial Setup</option>
          <option :value="logType('MAINT')">Maintenance</option>
        </select>

        <input v-model="filters.startDate" type="date" class="input-control date-box"
          :disabled="filters.period !== 'custom'" :class="{ 'bg-gray-100': filters.period !== 'custom' }">
        <span class="separator">to</span>
        <input v-model="filters.endDate" type="date" class="input-control date-box"
          :disabled="filters.period !== 'custom'" :class="{ 'bg-gray-100': filters.period !== 'custom' }">

        <button @click="resetFilters" class="reset-btn" title="Reset to Current FY">
          ↺
        </button>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Member</th>
            <th>Activity</th>
            <th>Hours</th>
            <th>Sheet</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in filteredLogs" :key="log.id">
            <td class="date-col">{{ formatDate(log.Date) }}</td>
            <td class="member-name">
              {{ getMemberName(log.MemberEmail) }}
            </td>
            <td>
              <div class="activity-cell">
                <span class="activity-text">{{ log.Activity }}</span>
                <span class="type-tag" :class="getTypeClass(log.type)">
                  {{ log.type || logType('STANDARD') }}
                </span>
              </div>
            </td>
            <td class="hours-col">
              {{ log.Hours }}
              <span v-if="log.clockHours && log.clockHours != log.Hours" class="clock-hours">
                ({{ log.clockHours }}h actual)
              </span>
            </td>
            <td>
              <span v-if="log.SourceSheet && log.SourceSheet !== 'none'" class="sheet-badge">
                #{{ log.SourceSheet }}
              </span>
            </td>
            <td>
              <button @click="openEdit(log)" class="action-btn">✏️</button>
              <button @click="confirmDelete(log.id)" class="action-btn delete">🗑️</button>
            </td>
          </tr>
          <tr v-if="filteredLogs.length === 0">
            <td colspan="5" class="empty-state">No logs found for this period.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
<div v-if="editingLog" class="modal-overlay">
  <div class="modal-content">
    <h3>Edit Log Entry</h3>
    
    <label>Activity Description</label>
    <input v-model="editForm.Activity" class="input-control w-full" />

    <label>Sport</label>
    <input v-model="editForm.Sport" class="input-control w-full" placeholder="e.g. Agility" />
    
    <div class="flex gap-2 mb-2">
      <div class="w-1/2">
        <label>Hours</label>
        <input v-model.number="editForm.Hours" type="number" step="0.25" class="input-control w-full" />
      </div>
      <div class="w-1/2">
        <label>Type (Category)</label>
        <select v-model="editForm.type" class="input-control w-full">
          <option :value="logType('STANDARD')">Standard</option>
          <option :value="logType('MAINT')">Maintenance</option>
          <option :value="logType('SETUP')">Trial Setup</option>
        </select>
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-4">
      <button @click="editingLog = null" class="btn-cancel">Cancel</button>
      <button @click="saveEdit" class="btn-save">Save Changes</button>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import { useMembersStore } from '@/stores/membersStore'

const logsStore = useLogsStore()
const memberStore = useMembersStore()
const logType = logsStore.logType;

const filters = reactive({
  search: '',
  type: 'all',
  period: 'current_fy', // Default
  startDate: '',
  endDate: ''
})

const editingLog = ref(null)
const editForm = reactive({
  id: '',
  Activity: '',
  Hours: 0,
  type: logType('STANDARD'),
  Sport: ''
})

const openEdit = (log) => {
  editingLog.value = log
  editForm.id = log.id
  editForm.Activity = log.Activity
  // Initialize with clockHours (actual time) so user edits base hours
  editForm.Hours = log.clockHours || log.Hours 
  editForm.type = log.type || logType('STANDARD')
  editForm.Sport = log.Sport || ''
}

const saveEdit = async () => {
  const type = editForm.type || logType('STANDARD');
  let multiplier = 1;

  // Check if the type qualifies for double time
  if (type === logType('MAINT') || type === logType('SETUP')) {
    multiplier = 2;
  }

  // Treat the entered value as base Clock Hours
  const enteredHours = parseFloat(editForm.Hours) || 0;
  const creditedHours = enteredHours * multiplier;

  await logsStore.updateLog(editForm.id, {
    Activity: editForm.Activity,
    Hours: creditedHours,      // Credited time (doubled if applicable)
    clockHours: enteredHours,  // Actual base time
    type: editForm.type,
    Sport: editForm.Sport
  })
  editingLog.value = null
}

const confirmDelete = async (id) => {
  if (confirm('Delete this log permanently?')) {
    await logsStore.deleteLog(id)
  }
}
// --- FISCAL YEAR LOGIC (Oct 1 - Sept 30) ---
const getFYDates = (offset = 0) => {
  const now = new Date()
  const currentMonth = now.getMonth() // 0-11
  const currentYear = now.getFullYear()

  // If we are in Jan-Sept (0-8), FY started Oct prev year.
  // If we are in Oct-Dec (9-11), FY started Oct this year.
  let startYear = currentMonth >= 9 ? currentYear : currentYear - 1

  // Apply Offset (e.g. -1 for Last FY)
  startYear += offset

  const start = new Date(startYear, 9, 1) // Oct 1
  const end = new Date(startYear + 1, 9, 1) // Oct 1 next year (exclusive in logic, but inclusive in date picker requires -1 day usually, but straightforward works for comparison)
  // Adjust end to Sept 30 for the Date Picker Display
  const endDisplay = new Date(startYear + 1, 8, 30)

  return {
    start: start.toISOString().split('T')[0],
    end: endDisplay.toISOString().split('T')[0],
    label: `FY${(startYear + 1).toString().slice(-2)}`
  }
}

const currentFYLabel = computed(() => getFYDates(0).label)

const periodLabel = computed(() => {
  if (filters.period === 'current_fy') return currentFYLabel.value
  if (filters.period === 'last_fy') return 'Last FY'
  if (filters.period === 'all') return 'All Time'
  return 'Custom'
})

const applyPeriod = () => {
  if (filters.period === 'current_fy') {
    const dates = getFYDates(0)
    filters.startDate = dates.start
    filters.endDate = dates.end
  } else if (filters.period === 'last_fy') {
    const dates = getFYDates(-1)
    filters.startDate = dates.start
    filters.endDate = dates.end
  } else if (filters.period === 'all') {
    filters.startDate = ''
    filters.endDate = ''
  }
  // 'custom' does nothing, leaves inputs editable
}

// Reset
const resetFilters = () => {
  filters.search = ''
  filters.type = 'all'
  filters.period = 'current_fy'
  applyPeriod()
}

onMounted(() => {
  logsStore.initLogs()
  memberStore.initMembers()
  applyPeriod() // Init dates
})

// --- HELPERS ---
const getMemberName = (email) => {
  const m = memberStore.getMemberByEmail(email)
  return m ? `${m.LastName}, ${m.FirstName}` : email
}

const formatDate = (ts) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

const getNormalizedType = (type) => {
  if (!type || type === '') return logType('STANDARD')
  return type
}

const getTypeClass = (type) => {
  const t = getNormalizedType(type)
  if (t === logType('MAINT')) return 'maintenance'
  if (t === logType('SETUP')) return 'setup'
  return 'standard'
}

// --- FILTERING ---
const filteredLogs = computed(() => {
  let list = logsStore.logs
  list = list.filter(l => l.Status !== 'active')

  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter(l =>
      l.MemberEmail?.toLowerCase().includes(q) ||
      l.Activity?.toLowerCase().includes(q) ||
      getMemberName(l.MemberEmail).toLowerCase().includes(q)
    )
  }

  if (filters.type !== 'all') {
    list = list.filter(l => getNormalizedType(l.type) === filters.type)
  }

  if (filters.startDate) {
    const start = new Date(filters.startDate)
    start.setHours(0, 0, 0, 0) // Start of day
    // Adjust for timezone offset issues with simple string parsing if needed, 
    // but usually string 'YYYY-MM-DD' parses to UTC in some browsers or Local in others.
    // Safe approach: create date and ensure comparison works. 
    // Simplified here for brevity.
    list = list.filter(l => {
      const d = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date)
      return d >= start
    })
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate)
    end.setHours(23, 59, 59, 999) // End of day
    list = list.filter(l => {
      const d = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date)
      return d <= end
    })
  }

  return list
})

const stats = computed(() => {
  const s = { totalHours: 0, maintenance: 0, setup: 0 }

  filteredLogs.value.forEach(l => {
    const h = Number(l.Hours) || 0
    const t = getNormalizedType(l.type)
    s.totalHours += h
    if (t === logType('MAINT')) s.maintenance += h
    if (t === logType('SETUP')) s.setup += h
  })

  s.totalHours = parseFloat(s.totalHours.toFixed(2))
  s.maintenance = parseFloat(s.maintenance.toFixed(2))
  s.setup = parseFloat(s.setup.toFixed(2))

  return s
})
</script>

<style scoped>
.log-history {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

/* STATS BAR */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 1rem;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.stat-card {
  background: white;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.stat-card.primary {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.stat-card.primary .stat-value {
  color: #1d4ed8;
}

.stat-card.maintenance {
  background: #fff7ed;
  border-color: #fed7aa;
}

.stat-card.maintenance .stat-value {
  color: #c2410c;
}

.stat-card.setup {
  background: #f5f3ff;
  border-color: #ddd6fe;
}

.stat-card.setup .stat-value {
  color: #6d28d9;
}

.stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.2;
}

/* TOOLBAR */
.toolbar {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  background-color: white;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.search-group {
  flex: 1;
  min-width: 250px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-control {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  outline: none;
}

.type-select {
  min-width: 150px;
}

.period-select {
  min-width: 140px;
  cursor: pointer;
}

.search-box {
  width: 100%;
}

.separator {
  color: #64748b;
  font-size: 0.875rem;
}

.reset-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #64748b;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.reset-btn:hover {
  background: #e2e8f0;
  color: #4f46e5;
  border-color: #4f46e5;
}

/* TABLE */
.table-container {
  flex: 1;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  position: sticky;
  top: 0;
  background-color: #f8fafc;
  z-index: 10;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

th {
  text-align: left;
  padding: 0.75rem 1.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

td {
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}

tr:hover {
  background-color: #f8fafc;
}

.date-col {
  white-space: nowrap;
  font-family: monospace;
  color: #64748b;
}

.hours-col {
  font-weight: bold;
  font-family: monospace;
}

.clock-hours {
  display: block;
  font-size: 0.7rem;
  font-weight: normal;
  color: #94a3b8;
}

.member-name {
  color: #4f46e5;
  font-weight: 600;
}

.activity-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.activity-text {
  font-weight: 500;
}

.type-tag {
  display: inline-block;
  width: fit-content;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.type-tag.standard {
  background: #f3f4f6;
  color: #6b7280;
}

.type-tag.maintenance {
  background: #ffedd5;
  color: #c2410c;
}

.type-tag.setup {
  background: #f3e8ff;
  color: #7e22ce;
}

.sheet-badge {
  background-color: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-family: monospace;
  color: #475569;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  font-style: italic;
}

/* Add to <style scoped> */
.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  margin-right: 0.5rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  width: 400px;
}

/* Add to <style scoped> */
.action-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-right: 0.5rem; }
.action-btn.delete { color: #dc2626; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 50; }
.modal-content { background: white; padding: 2rem; border-radius: 0.5rem; width: 500px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.btn-save { background: #4f46e5; color: white; padding: 0.5rem 1rem; border-radius: 0.25rem; }
.btn-cancel { background: #e5e7eb; color: #374151; padding: 0.5rem 1rem; border-radius: 0.25rem; }
.action-btn.delete { color: #dc2626; }
.modal-form-row { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }
.form-col { flex: 1; }
.form-col label { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; }
.input-control.w-full { width: 100%; box-sizing: border-box; }
</style>