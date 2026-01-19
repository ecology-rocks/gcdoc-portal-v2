<template>
  <div class="log-history">
    
    <div class="stats-bar">
      <div class="stat-card">
        <span class="stat-label">Total Logs</span>
        <span class="stat-value">{{ filteredLogs.length }}</span>
      </div>
      <div class="stat-card primary">
        <span class="stat-label">Total Credited Hours</span>
        <span class="stat-value">{{ stats.totalHours }}</span>
      </div>
      <div class="stat-card maintenance">
        <span class="stat-label">Maintenance (2x)</span>
        <span class="stat-value">{{ stats.maintenance }}</span>
      </div>
      <div class="stat-card setup">
        <span class="stat-label">Event Setup (2x)</span>
        <span class="stat-value">{{ stats.setup }}</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-group">
        <input 
          v-model="filters.search" 
          type="text" 
          placeholder="Search member or activity..." 
          class="input-control search-box"
        >
      </div>
      
      <div class="filter-group">
        <select v-model="filters.type" class="input-control type-select">
          <option value="all">All Types</option>
          <option :value="TYPES.STANDARD">Standard (1x)</option>
          <option :value="TYPES.SETUP">Trial Setup (2x)</option>
          <option :value="TYPES.MAINT">Maintenance (2x + Voucher)</option>
        </select>
        
        <input 
          v-model="filters.startDate" 
          type="date" 
          class="input-control date-box" 
          title="Start Date"
        >
        <span class="separator">to</span>
        <input 
          v-model="filters.endDate" 
          type="date" 
          class="input-control date-box" 
          title="End Date"
        >
        
        <button @click="resetFilters" class="reset-btn" title="Clear Filters">
          ✕
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
                <span 
                  class="type-tag" 
                  :class="getTypeClass(log.type)"
                >
                  {{ log.type || TYPES.STANDARD }}
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
          </tr>
          <tr v-if="filteredLogs.length === 0">
            <td colspan="5" class="empty-state">No logs found matching your filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import { useMembersStore } from '@/stores/membersStore'

const logsStore = useLogsStore()
const memberStore = useMembersStore()

// --- CONSTANTS (Exact DB Strings) ---
const TYPES = {
  MAINT: "Cleaning / Maintenance (2x + Blue Ribbon)",
  STANDARD: "Standard / Regular (1x)",
  SETUP: "Trial Setup / Teardown (2x)"
}

// State
const filters = reactive({
  search: '',
  type: 'all',
  startDate: '',
  endDate: ''
})

onMounted(() => {
  logsStore.initLogs()
  memberStore.initMembers()
})

// Helpers
const getMemberName = (email) => {
  const m = memberStore.getMemberByEmail(email)
  return m ? `${m.LastName}, ${m.FirstName}` : email
}

const formatDate = (ts) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

const resetFilters = () => {
  filters.search = ''
  filters.type = 'all'
  filters.startDate = ''
  filters.endDate = ''
}

// Helper to normalize blank types to Standard
const getNormalizedType = (type) => {
  if (!type || type === '') return TYPES.STANDARD
  return type
}

const getTypeClass = (type) => {
  const t = getNormalizedType(type)
  if (t === TYPES.MAINT) return 'maintenance'
  if (t === TYPES.SETUP) return 'setup'
  return 'standard'
}

// 1. FILTER LOGIC
const filteredLogs = computed(() => {
  let list = logsStore.logs

  // Search Text
  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter(l => 
      l.MemberEmail?.toLowerCase().includes(q) || 
      l.Activity?.toLowerCase().includes(q) ||
      getMemberName(l.MemberEmail).toLowerCase().includes(q)
    )
  }

  // Type Filter
  if (filters.type !== 'all') {
    list = list.filter(l => getNormalizedType(l.type) === filters.type)
  }

  // Date Range
  if (filters.startDate) {
    const start = new Date(filters.startDate)
    start.setHours(0,0,0,0) 
    list = list.filter(l => {
      const d = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date)
      return d >= start
    })
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate)
    end.setHours(23,59,59,999) 
    list = list.filter(l => {
      const d = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date)
      return d <= end
    })
  }

  return list
})

// 2. CALCULATION LOGIC
const stats = computed(() => {
  const s = {
    totalHours: 0,
    maintenance: 0,
    setup: 0
  }
  
  filteredLogs.value.forEach(l => {
    const h = Number(l.Hours) || 0
    const t = getNormalizedType(l.type)

    s.totalHours += h
    
    if (t === TYPES.MAINT) s.maintenance += h
    if (t === TYPES.SETUP) s.setup += h
  })
  
  // Format
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

.stat-card.primary { background: #eff6ff; border-color: #bfdbfe; }
.stat-card.primary .stat-value { color: #1d4ed8; }

.stat-card.maintenance { background: #fff7ed; border-color: #fed7aa; }
.stat-card.maintenance .stat-value { color: #c2410c; }

.stat-card.setup { background: #f5f3ff; border-color: #ddd6fe; }
.stat-card.setup .stat-value { color: #6d28d9; }


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
  color: #ef4444;
  border-color: #ef4444;
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
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
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
.type-tag.standard { background: #f3f4f6; color: #6b7280; }
.type-tag.maintenance { background: #ffedd5; color: #c2410c; }
.type-tag.setup { background: #f3e8ff; color: #7e22ce; }

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
</style>