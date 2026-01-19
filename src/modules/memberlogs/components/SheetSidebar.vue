<template>
  <div class="sidebar">
    <div class="filters">
      <div class="filter-header">
        <h3>Sheet Filters</h3>
        <label class="toggle">
          <input type="checkbox" v-model="showCompleted">
          <span>Show Completed</span>
        </label>
      </div>
      
      <div class="date-filters">
        <select v-model="filterYear">
          <option value="all">All Years</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        <select v-model="filterMonth">
          <option value="all">All Months</option>
          <option v-for="(m, i) in months" :key="i" :value="i">{{ m }}</option>
        </select>
      </div>

      <div class="upload-section">
        <button v-if="!showUpload" @click="showUpload = true" class="btn-outline">
          + Upload New Sheet
        </button>
        <div v-else class="upload-box">
          <h4>Upload Image</h4>
          <input type="file" @change="handleFileUpload" accept="image/*">
          <div class="actions">
            <button @click="uploadSheet" :disabled="!uploadFile" class="btn-primary">Confirm</button>
            <button @click="showUpload = false" class="btn-text">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <div class="sheet-list">
      <div v-if="filteredSheets.length === 0" class="no-results">
        No sheets found.
      </div>
      <div 
        v-for="sheet in filteredSheets" 
        :key="sheet.id" 
        class="sheet-item"
        :class="{ active: activeSheetId === sheet.id }"
        @click="$emit('select', sheet)"
      >
        <div class="sheet-row">
          <span class="sheet-id">#{{ sheet.shortId }}</span>
          <span class="sheet-date">{{ formatDate(sheet.uploadedAt) }}</span>
        </div>
        <div class="sheet-row">
          <span class="status-badge" :class="sheet.status">
            {{ sheet.status }}
          </span>
          <span class="log-count">{{ sheet.logCount }} logs</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSheetsStore } from '@/stores/sheetsStore'

const props = defineProps(['activeSheetId'])
defineEmits(['select'])

const sheetsStore = useSheetsStore()
const showUpload = ref(false)
const uploadFile = ref(null)
const showCompleted = ref(false)
const filterYear = ref('all')
const filterMonth = ref('all')
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

onMounted(() => {
  sheetsStore.initSheets()
})

const filteredSheets = computed(() => {
  return sheetsStore.sheets.filter(s => {
    if (!showCompleted.value && s.status === 'processed') return false
    const d = s.uploadedAt.toDate ? s.uploadedAt.toDate() : new Date(s.uploadedAt)
    if (filterYear.value !== 'all' && d.getFullYear().toString() !== filterYear.value) return false
    if (filterMonth.value !== 'all' && d.getMonth().toString() !== filterMonth.value) return false
    return true
  })
})

const formatDate = (ts) => {
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString()
}

const handleFileUpload = (e) => uploadFile.value = e.target.files[0]

const uploadSheet = async () => {
  if (!uploadFile.value) return
  await sheetsStore.uploadSheet(uploadFile.value, 'admin')
  uploadFile.value = null
  showUpload.value = false
}
</script>

<style scoped>
.sidebar {
  width: 350px;
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  flex-shrink: 0;
}

.filters {
  padding: 1rem;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.filter-header h3 {
  font-size: 0.875rem;
  font-weight: bold;
  color: #1f2937;
}

.toggle {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  cursor: pointer;
}

.date-filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

select {
  width: 50%;
  padding: 0.25rem;
  font-size: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}

.btn-outline {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #c7d2fe;
  color: #4f46e5;
  background: white;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.upload-box {
  background: #e0e7ff;
  padding: 0.75rem;
  border-radius: 0.375rem;
}

.upload-box h4 {
  font-size: 0.75rem;
  font-weight: bold;
  color: #3730a3;
  margin-bottom: 0.5rem;
}

.upload-box input {
  width: 100%;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  flex: 1;
  background: #4f46e5;
  color: white;
  border: none;
  padding: 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.btn-text {
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 0.75rem;
  cursor: pointer;
}

.sheet-list {
  flex: 1;
  overflow-y: auto;
}

.no-results {
  padding: 2rem;
  text-align: center;
  font-size: 0.875rem;
  color: #9ca3af;
}

.sheet-item {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  border-left: 4px solid transparent;
  cursor: pointer;
}

.sheet-item:hover {
  background-color: #f9fafb;
}

.sheet-item.active {
  background-color: #e0e7ff;
  border-left-color: #4f46e5;
}

.sheet-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.sheet-id {
  font-family: monospace;
  font-weight: bold;
  font-size: 1rem;
}

.sheet-date {
  font-size: 0.75rem;
  color: #6b7280;
}

.status-badge {
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  text-transform: uppercase;
  font-weight: bold;
}

.status-badge.processed {
  background-color: #d1fae5;
  color: #065f46;
}

.status-badge.pending {
  background-color: #fef3c7;
  color: #92400e;
}

.log-count {
  font-size: 0.75rem;
  color: #9ca3af;
}
</style>