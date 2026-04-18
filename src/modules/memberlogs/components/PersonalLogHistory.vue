<template>
  <div class="history-container">
    
    <div class="stats-grid">
      
      <div class="stat-card highlight-card">
        <div class="stat-value">{{ myVouchers }}</div>
        <div class="stat-label">Service Vouchers<br>(Fiscal Year)</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value">{{ myFYHours }}</div>
        <div class="stat-label">Fiscal Year<br>Hours</div>
      </div>

      <div class="stat-card">
        <div class="stat-value">{{ mySpecialHours }}</div>
        <div class="stat-label">Special Hours<br>(Clean/Setup)</div>
      </div>

      <div class="stat-card blue-card">
        <div class="stat-value">{{ myBlueVouchers }}</div>
        <div class="stat-label">Blue Vouchers<br>Earned</div>
      </div>

    </div>

    <div class="history-list">
      <h3>Recent Activity</h3>
      
      <div v-if="loading" class="empty-msg">Loading history...</div>
      <div v-else-if="myLogs.length === 0" class="empty-msg">No logs found yet. Start volunteering!</div>
      
      <div v-else class="logs-wrapper">
        <div v-for="log in myLogs" :key="log.id" class="log-item">
          <div class="log-date">
            <span class="day">{{ formatDate(log.Date).day }}</span>
            <span class="month">{{ formatDate(log.Date).month }}</span>
          </div>
          
          <div class="log-details">
            <div class="log-act">{{ log.Activity || log.type }}</div>
            <div class="log-meta">
              {{ log.Sport ? log.Sport + ' • ' : '' }}
              <span :class="['status-badge', log.Status]">
                {{ log.Status }}
              </span>
            </div>
          </div>

          <div class="log-hours">
            {{ log.Hours }} hrs
          </div>
        </div>
      </div>

      <div class="history-actions">
        <button @click="openMyReport" class="btn-view-all">View All</button>
      </div>
    </div>

    <div v-if="showReportModal && reportData" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h2>Volunteer Hours Report</h2>
          <button @click="showReportModal = false" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
          <div class="report-header">
            <h3>{{ reportData.memberName }}</h3>
            <p>Fiscal Year: {{ reportData.fyString }}</p>
          </div>

          <div class="report-summary">
            <div class="summary-box">
              <div class="summary-value">{{ reportData.totalHrs }}</div>
              <div class="summary-label">Total FY Hours</div>
            </div>
            <div class="summary-box">
              <div class="summary-value">{{ reportData.stdVouchers }}</div>
              <div class="summary-label">Standard Vouchers</div>
            </div>
            <div class="summary-box">
              <div class="summary-value">{{ reportData.blueVouchers }}</div>
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
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in reportData.logs" :key="log.id">
                <td>{{ formatDate(log.Date).month }} {{ formatDate(log.Date).day }}</td>
                <td>{{ log.Activity }}</td>
                <td>{{ log.type }}</td>
                <td class="text-right">{{ log.Hours }}</td>
              </tr>
              <tr v-if="reportData.logs.length === 0">
                <td colspan="4" class="empty-msg">No hours logged this fiscal year.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import { useAuthStore } from '@/stores/authStore'

const logsStore = useLogsStore()
const authStore = useAuthStore()
const showReportModal = ref(false)
const reportData = ref(null)

const loading = computed(() => logsStore.loading)

onMounted(() => {
  logsStore.initLogs()
})

// Filter logs for the logged-in user
const myLogs = computed(() => {
  const email = authStore.user?.email?.toLowerCase()
  if (!email) return []
  return logsStore.logs
    .filter(l => l.MemberEmail?.toLowerCase() === email)
    .slice(0, 10)
})

const myFYLogs = computed(() => {
  const email = authStore.user?.email?.toLowerCase()
  if (!email) return []

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const startYear = currentMonth >= 9 ? currentYear : currentYear - 1
  const startDate = new Date(startYear, 9, 1)
  const endDate = new Date(startYear + 1, 9, 1)

  return logsStore.logs
    .filter(l => {
      if (l.MemberEmail?.toLowerCase() !== email) return false
      const d = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date)
      return d >= startDate && d < endDate
    })
    .sort((a, b) => {
      const dateA = a.Date?.toDate ? a.Date.toDate() : new Date(a.Date)
      const dateB = b.Date?.toDate ? b.Date.toDate() : new Date(b.Date)
      return dateA - dateB
    })
})

// --- METRICS ---

const myVouchers = computed(() => {
  const email = authStore.user?.email?.toLowerCase()
  return logsStore.vouchersByMember[email] || 0
})

const myFYHours = computed(() => {
  const email = authStore.user?.email?.toLowerCase()
  const hrs = logsStore.fiscalYearHours[email] || 0
  return Math.round(hrs * 100) / 100
})

const mySpecialHours = computed(() => {
  const email = authStore.user?.email?.toLowerCase()
  const hrs = logsStore.specialHoursByMember[email] || 0
  return Math.round(hrs * 100) / 100
})

const myBlueVouchers = computed(() => {
  const email = authStore.user?.email?.toLowerCase()
  return logsStore.blueVouchersByMember[email] || 0
})

const openMyReport = () => {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const startYear = currentMonth >= 9 ? currentYear : currentYear - 1

  reportData.value = {
    memberName: `${authStore.profile?.FirstName || 'Member'} ${authStore.profile?.LastName || ''}`.trim(),
    fyString: `Oct 1, ${startYear} - Sep 30, ${startYear + 1}`,
    logs: myFYLogs.value,
    totalHrs: myFYHours.value,
    stdVouchers: myVouchers.value,
    blueVouchers: myBlueVouchers.value
  }
  showReportModal.value = true
}

const formatDate = (timestamp) => {
  if (!timestamp) return { day: '?', month: '?' }
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return {
    day: d.getDate(),
    month: d.toLocaleString('default', { month: 'short' })
  }
}
</script>

<style scoped>
.history-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.stat-card {
  background: white;
  padding: 1rem;
  border-radius: 0.75rem;
  text-align: center;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Specific Card Styles */
.highlight-card {
  border-color: #c7d2fe;
  background: #eef2ff;
}
.highlight-card .stat-value { color: #4f46e5; }

.blue-card {
  border-color: #bfdbfe;
  background: #eff6ff;
}
.blue-card .stat-value { color: #2563eb; }

.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1f2937;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.7rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  margin-top: 0.25rem;
  line-height: 1.2;
}

/* List */
.history-list {
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  padding: 1rem;
  flex: 1; 
  display: flex;
  flex-direction: column;
  max-height: 500px;
}

.history-list h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #1f2937;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.logs-wrapper {
  overflow-y: auto;
  flex: 1;
  padding-right: 0.5rem;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.log-item:last-child { border-bottom: none; }

.log-date {
  background: #f3f4f6;
  border-radius: 0.5rem;
  padding: 0.4rem;
  min-width: 3.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
}

.day { font-weight: 700; font-size: 1.1rem; line-height: 1; color: #1f2937; }
.month { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; }

.log-details {
  flex: 1;
  min-width: 0;
}

.log-act {
  font-weight: 600;
  font-size: 0.9rem;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-meta {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-badge {
  text-transform: uppercase;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
}

.status-badge.approved { background: #dcfce7; color: #166534; }
.status-badge.pending { background: #fef9c3; color: #854d0e; }
.status-badge.active { background: #dbeafe; color: #1e40af; }

.log-hours {
  font-weight: 700;
  font-size: 0.9rem;
  color: #4b5563;
  white-space: nowrap;
}

.empty-msg {
  text-align: center;
  color: #9ca3af;
  font-style: italic;
  margin-top: 2rem;
}

.history-actions {
  margin-top: 0.75rem;
  border-top: 1px solid #f3f4f6;
  padding-top: 0.75rem;
  text-align: right;
}

.btn-view-all {
  background: #eef2ff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
  padding: 0.4rem 0.75rem;
  border-radius: 0.4rem;
  font-weight: 700;
  cursor: pointer;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
  padding: 1rem;
}

.modal-container {
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow: auto;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-body {
  padding: 1rem 1.25rem 1.25rem;
}

.close-btn {
  border: none;
  background: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #6b7280;
}

.report-header h3 {
  margin: 0;
}

.report-header p {
  margin: 0.25rem 0 1rem;
  color: #6b7280;
}

.report-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.summary-box {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.75rem;
  text-align: center;
}

.summary-value {
  font-size: 1.25rem;
  font-weight: 800;
}

.summary-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
}

.report-table th,
.report-table td {
  border-bottom: 1px solid #eef2f7;
  padding: 0.6rem;
  text-align: left;
  font-size: 0.9rem;
}

.text-right {
  text-align: right;
}

.logs-wrapper::-webkit-scrollbar { width: 6px; }
.logs-wrapper::-webkit-scrollbar-track { background: transparent; }
.logs-wrapper::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 20px; }
</style>