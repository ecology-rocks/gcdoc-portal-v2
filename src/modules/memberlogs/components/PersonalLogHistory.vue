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
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import { useAuthStore } from '@/stores/authStore'

const logsStore = useLogsStore()
const authStore = useAuthStore()

const loading = computed(() => logsStore.loading)

onMounted(() => {
  if (logsStore.logs.length === 0) {
    logsStore.initLogs()
  }
})

// Filter logs for the logged-in user
const myLogs = computed(() => {
  const email = authStore.user?.email?.toLowerCase()
  if (!email) return []
  return logsStore.logs
    .filter(l => l.MemberEmail?.toLowerCase() === email)
    .slice(0, 10)
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

.logs-wrapper::-webkit-scrollbar { width: 6px; }
.logs-wrapper::-webkit-scrollbar-track { background: transparent; }
.logs-wrapper::-webkit-scrollbar-thumb { background-color: #e5e7eb; border-radius: 20px; }
</style>