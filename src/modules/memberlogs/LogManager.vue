<template>
  <div class="log-manager-container">
    <div class="header">
      <h1>Log Management</h1>
      <div class="nav-tabs">
        <button 
          @click="viewMode = 'list'" 
          :class="{ active: viewMode === 'list' }">
          📋 Log History
        </button>
<button 
  @click="viewMode = 'approvals'" 
  :class="{ active: viewMode === 'approvals' }">
  ✅ Approvals
  <span v-if="pendingCount > 0" class="badge">{{ pendingCount }}</span>
</button>
        <button 
          @click="viewMode = 'single'" 
          :class="{ active: viewMode === 'single' }">
          ➕ Single Entry
        </button>
        <button 
          @click="viewMode = 'sheets'" 
          :class="{ active: viewMode === 'sheets' }">
          📑 Sheet Processor
        </button>
      </div>
    </div>

    <div class="content-area">
      <LogHistory v-if="viewMode === 'list'" />
      <SingleEntryForm v-else-if="viewMode === 'single'" />
      <SheetManager v-else-if="viewMode === 'sheets'" />
      <LogApprovals v-else-if="viewMode === 'approvals'" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import LogHistory from './components/LogHistory.vue'
import SingleEntryForm from './components/SingleEntryForm.vue'
import SheetManager from './components/SheetManager.vue'
import LogApprovals from './components/LogApprovals.vue'
import { useLogsStore } from '@/stores/logsStore'

const viewMode = ref('list')
const logsStore = useLogsStore()
const pendingCount = computed(() => logsStore.pendingLogs.length)
</script>

<style scoped>
.log-manager-container {
  max-width: 1280px;
  margin: 0 auto;
  height: calc(100vh - 8rem);
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

h1 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #111827;
}

.badge {
  background: #ef4444;
  color: white;
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  margin-left: 0.5rem;
}

.nav-tabs {
  display: flex;
  gap: 0.75rem;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  color: #4b5563;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  background-color: #f3f4f6;
}

button.active {
  background-color: #e0e7ff;
  color: #4338ca;
  border-color: #c7d2fe;
}

.content-area {
  flex: 1;
  overflow: hidden;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}
</style>