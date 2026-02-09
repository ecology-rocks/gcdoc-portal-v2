<template>
  <div class="meeting-view">
    
    <div class="page-header">
      <div class="header-left">
        <h1>Meeting Prep</h1>
        <p class="subtitle">Overview for {{ new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }} General Meeting</p>
      </div>
      <div class="header-right">
        <div class="big-number highlight">{{ membersStore.votingMembers.length }}</div>
        <div class="label">Voting Members</div>
      </div>
    </div>

    <div class="stats-grid">
      
      <div class="stat-card border-indigo">
        <h3>Quorum Required (20%)</h3>
        <div class="stat-value">
          <span class="number">{{ quorum }}</span>
          <span class="unit">members present</span>
        </div>
      </div>

      <div class="stat-card border-green">
        <h3>Pending Applicants</h3>
        <div class="stat-value">
          <span class="number">{{ membersStore.applicants.length }}</span>
          <span class="unit">to vote in</span>
        </div>
      </div>

      <div class="stat-card border-purple">
        <h3>Fiscal Year Activity (YTD)</h3>
        <div class="stat-value">
          <span class="number">{{ totalCreditedHoursFY }}</span>
          <span class="unit">credited hours</span>
        </div>
        <div class="sub-text">Since Oct 1, {{ fyStartYear }}</div>
      </div>
    </div>

    <div class="content-grid">
      
      <div class="panel">
        <div class="panel-header">
          <h3>📋 Applicant List</h3>
          <span class="badge warning">Pending Vote</span>
        </div>
        
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>FY Hours</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sortedApplicants.length === 0">
                <td colspan="3" class="empty-state">No pending applicants.</td>
              </tr>
              <tr v-for="member in sortedApplicants" :key="member.id">
                <td class="font-bold">
                  {{ member.LastName }}, {{ member.FirstName }}
                </td>
                <td>
                   <span class="badge" 
                    :class="getApplicantHours(member.Email) >= 10 ? 'success' : 'neutral'">
                     {{ getApplicantHours(member.Email) }} hrs
                   </span>
                </td>
                <td>
                  <button 
                    @click="copyToClipboard(member.Email)"
                    class="copy-btn"
                    :title="'Copy ' + member.Email"
                  >
                    <span class="email-text">{{ member.Email }}</span>
                    <span class="copy-icon">
                      {{ copiedEmail === member.Email ? 'Copied!' : '📋' }}
                    </span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>📊 Fiscal Year Breakdown</h3>
          <span class="meta">Actual Clock Hours</span>
        </div>
        <div class="panel-body">
           <div v-if="loadingLogs" class="loading-state">Loading stats...</div>
           <div v-else class="chart-list">
             <div v-for="(count, type) in logBreakdown" :key="type" class="chart-row">
               <div class="chart-label" :title="type">{{ type }}</div>
               <div class="chart-bar-bg">
                 <div class="chart-bar-fill" :style="{ width: `${(count / totalActualHoursFY) * 100}%` }"></div>
               </div>
               <div class="chart-value">{{ count }}h</div>
             </div>
             <div v-if="totalActualHoursFY == 0" class="empty-state">
               No hours logged this fiscal year yet.
             </div>
           </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const membersStore = useMembersStore()
const logsStore = useLogsStore()
const loadingLogs = ref(false)
const copiedEmail = ref(null)

onMounted(async () => {
  await membersStore.initMembers()
  loadingLogs.value = true
  await logsStore.initLogs()
  loadingLogs.value = false
})

// Quorum
const quorum = computed(() => {
  return Math.ceil(membersStore.votingMembers.length * 0.2)
})

// --- DATE LOGIC ---
const now = new Date()
const currentMonth = now.getMonth()
const currentYear = now.getFullYear()
const fyStartYear = currentMonth >= 9 ? currentYear : currentYear - 1
const fyStartDate = new Date(fyStartYear, 9, 1) // Oct 1

// --- HELPERS ---
const getApplicantHours = (email) => {
  if (!email) return 0
  return logsStore.fiscalYearHours[email] || 0
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedEmail.value = text
    setTimeout(() => { copiedEmail.value = null }, 2000)
  } catch (err) {
    console.error('Failed to copy!', err)
  }
}

const sortedApplicants = computed(() => {
  return [...membersStore.applicants].sort((a, b) => {
    return getApplicantHours(b.Email) - getApplicantHours(a.Email)
  })
})

// --- STATS ---

const fyLogs = computed(() => {
  return logsStore.logs.filter(l => {
    const d = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date)
    return d >= fyStartDate
  })
})

const totalCreditedHoursFY = computed(() => {
  return fyLogs.value.reduce((acc, l) => acc + (Number(l.Hours) || 0), 0).toFixed(1)
})

const logBreakdown = computed(() => {
  const breakdown = {}
  
  fyLogs.value.forEach(l => {
    const type = (l.type && l.type !== '') ? l.type : 'Standard / Regular (1x)'
    let val = 0
    
    if (l.clockHours) {
      val = Number(l.clockHours)
    } else {
      const isDoubled = type.includes('2x')
      val = Number(l.Hours) || 0
      if (isDoubled) val = val / 2
    }
    
    breakdown[type] = (breakdown[type] || 0) + val
  })
  
  for (const k in breakdown) {
    breakdown[k] = Number(breakdown[k].toFixed(1))
  }
  
  return breakdown
})

const totalActualHoursFY = computed(() => {
  const values = Object.values(logBreakdown.value)
  return values.reduce((acc, v) => acc + v, 0)
})

</script>

<style scoped>
/* --- Page Layout --- */
.meeting-view {
  max-width: 1200px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}

/* --- Header --- */
.page-header {
  display: flex;
  flex-direction: column; /* Mobile first: stack vertically */
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.header-left h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0;
  color: #111827;
}

.subtitle {
  color: #6b7280;
  margin: 0.25rem 0 0 0;
  font-size: 0.95rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.big-number {
  font-size: 2.25rem;
  font-weight: 900;
  line-height: 1;
}

.big-number.highlight {
  color: #4f46e5; /* Indigo */
}

.label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #9ca3af;
  letter-spacing: 0.05em;
}

/* --- Stats Grid --- */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr; /* Mobile: 1 column */
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left-width: 4px;
  border-left-style: solid;
}

.stat-card h3 {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #9ca3af;
  margin: 0 0 0.5rem 0;
}

.stat-value {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.stat-value .number {
  font-size: 2.25rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-value .unit {
  font-size: 0.875rem;
  color: #6b7280;
}

.sub-text {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

/* Border Colors */
.border-indigo { border-left-color: #4f46e5; }
.border-green { border-left-color: #22c55e; }
.border-purple { border-left-color: #a855f7; }

/* --- Content Grid --- */
.content-grid {
  display: grid;
  grid-template-columns: 1fr; /* Mobile: 1 column */
  gap: 2rem;
}

/* --- Panels --- */
.panel {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 1rem;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
}

.meta {
  font-size: 0.75rem;
  color: #9ca3af;
  font-family: monospace;
}

/* --- Badges --- */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge.warning { background-color: #fef3c7; color: #92400e; }
.badge.success { background-color: #dcfce7; color: #166534; }
.badge.neutral { background-color: #f3f4f6; color: #1f2937; }

/* --- Data Table --- */
.table-container {
  overflow-x: auto; /* CRITICAL: Enables horizontal scroll on mobile */
  width: 100%;
}

.data-table {
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table th {
  background-color: #f9fafb;
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap; /* Prevents wrapping in cells */
}

.data-table tr:hover {
  background-color: #f9fafb;
}

.data-table .font-bold {
  font-weight: 600;
  color: #111827;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  font-style: italic;
}

/* --- Copy Button --- */
.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #4f46e5;
  font-size: 0.875rem;
  padding: 0;
}

.copy-btn:hover {
  color: #312e81;
}

.email-text {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-icon {
  font-size: 0.75rem;
  background-color: #1f2937;
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.copy-btn:hover .copy-icon {
  opacity: 1;
}

/* --- Charts --- */
.panel-body {
  padding: 1rem;
}

.chart-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chart-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.chart-label {
  width: 180px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-bar-bg {
  flex: 1;
  height: 1rem;
  background-color: #f3f4f6;
  border-radius: 9999px;
  overflow: hidden;
}

.chart-bar-fill {
  height: 100%;
  background-color: #a855f7; /* Purple */
}

.chart-value {
  width: 3rem;
  text-align: right;
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
}

/* --- BREAKPOINTS (Desktop) --- */
@media (min-width: 768px) {
  .page-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-end;
  }
  
  .header-right {
    text-align: right;
    display: block; /* Stack number/label vertically on desktop */
  }

  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .content-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>