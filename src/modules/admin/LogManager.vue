<template>
  <div class="log-manager">
    <div class="header-section">
      <h1 class="page-title">Log Manager</h1>
      
      <div class="tabs-container">
        <button 
          @click="activeTab = 'history'"
          class="tab-btn"
          :class="{ active: activeTab === 'history' }"
        >
          History & Stats
        </button>
        
        <button 
          @click="activeTab = 'pending'"
          class="tab-btn"
          :class="{ active: activeTab === 'pending' }"
        >
          Pending Approvals
          <span v-if="logsStore.pendingLogs.length" class="badge-count">
            {{ logsStore.pendingLogs.length }}
          </span>
        </button>

        <button 
          @click="activeTab = 'entry'"
          class="tab-btn"
          :class="{ active: activeTab === 'entry' }"
        >
          Data Entry
        </button>
        
        <button 
          @click="activeTab = 'sheets'"
          class="tab-btn"
          :class="{ active: activeTab === 'sheets' }"
        >
          Sign-in Sheets
        </button>
      </div>
    </div>

    <div class="tab-content">
      
      <div v-if="activeTab === 'history'" class="history-view">
        <LogHistory />
      </div>

      <div v-if="activeTab === 'pending'" class="pending-view">
        <div v-if="logsStore.pendingLogs.length === 0" class="empty-state">
          <span class="emoji">✅</span>
          All caught up! No pending logs.
        </div>

        <div v-else class="pending-list">
          <div v-for="log in logsStore.pendingLogs" :key="log.id" class="pending-card">
            <div class="card-info">
              <div class="card-header">
                <span class="member-name">{{ log.MemberName }}</span>
                <span class="date-badge">{{ formatDate(log.Date) }}</span>
              </div>
              <div class="card-details">
                <span class="hours">{{ log.Hours }} hrs</span> - {{ log.Activity }}
              </div>
              <div class="card-source">Source: {{ log.SourceSheet }}</div>
            </div>
            
            <div class="card-actions">
              <button @click="logsStore.approveLog(log.id)" class="btn btn-approve">
                Approve
              </button>
              <button @click="logsStore.rejectLog(log.id)" class="btn btn-reject">
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'entry'" class="entry-view">
        <div class="form-wrapper">
          <SingleEntryForm />
        </div>
      </div>

      <div v-if="activeTab === 'sheets'">
        <SheetManager />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import LogHistory from './components/LogHistory.vue'
import SingleEntryForm from './components/SingleEntryForm.vue'
import SheetManager from './components/SheetManager.vue'

const logsStore = useLogsStore()
const activeTab = ref('history')

onMounted(() => {
  logsStore.initLogs()
})

const formatDate = (ts) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString()
}
</script>

<style scoped>
.log-manager {
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
  max-width: 1200px;
  margin: 0 auto;
}

/* --- Header & Tabs --- */
.header-section {
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.tabs-container {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto; /* Horizontal scroll on mobile */
  white-space: nowrap;
  padding-bottom: 2px; /* For active border visibility */
}

.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.tab-btn:hover {
  color: #374151;
}

.tab-btn.active {
  border-bottom-color: #4f46e5;
  color: #4f46e5;
}

.badge-count {
  position: absolute;
  top: -5px;
  right: -10px;
  background-color: #ef4444;
  color: white;
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 9999px;
  line-height: 1;
}

/* --- Tab Content Areas --- */
.history-view {
  height: calc(100vh - 200px);
  overflow-y: auto;
}

/* --- Pending Logs --- */
.pending-view {
  max-width: 800px;
  margin: 0 auto;
}

.empty-state {
  text-align: center;
  padding: 5rem 1rem;
  color: #9ca3af;
  background-color: white;
  border: 1px dashed #d1d5db;
  border-radius: 0.5rem;
}

.emoji {
  display: block;
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pending-card {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left: 4px solid #facc15; /* Yellow */
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-info {
  flex: 1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.member-name {
  font-weight: 700;
  font-size: 1.125rem;
  color: #1f2937;
}

.date-badge {
  font-size: 0.75rem;
  background-color: #f3f4f6;
  color: #6b7280;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-details {
  font-size: 0.875rem;
  color: #4b5563;
  margin-bottom: 0.25rem;
}

.hours {
  font-weight: 700;
}

.card-source {
  font-size: 0.75rem;
  color: #9ca3af;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-approve {
  background-color: #dcfce7;
  color: #15803d;
}
.btn-approve:hover { background-color: #bbf7d0; }

.btn-reject {
  background-color: #fef2f2;
  color: #dc2626;
}
.btn-reject:hover { background-color: #fee2e2; }

/* --- Data Entry --- */
.entry-view {
  max-width: 600px;
  margin: 0 auto;
}

.form-wrapper {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid #e5e7eb;
}

/* --- Breakpoints --- */
@media (min-width: 640px) {
  .pending-card {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  
  .card-actions {
    flex: 0 0 auto;
  }

  .btn {
    flex: initial; /* Buttons don't stretch on desktop */
  }
}
</style>