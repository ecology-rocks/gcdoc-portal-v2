<template>
  <div class="data-entry">
    <div class="entry-header">
      <div class="stats">
        <strong>Entries</strong>: {{ rows.length }}
        <button 
          @click="toggleStatus"
          class="status-toggle"
          :class="sheet.status"
        >
          {{ sheet.status === 'processed' ? '↺ Revert' : '✓ Mark Done' }}
        </button>
      </div>
      <button 
        @click="saveChanges" 
        class="save-btn" 
        :disabled="!hasUnsavedChanges"
        :class="{ dirty: hasUnsavedChanges }"
      >
        {{ hasUnsavedChanges ? 'Save Progress' : 'Saved' }}
      </button>
    </div>

    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th style="width: 30px">#</th>
            <th>Member</th>
            <th>Date</th>
            <th>Activity</th>
            <th style="width: 150px">Type</th>
            <th style="width: 60px">Hrs (Clock)</th>
            <th style="width: 30px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in rows" :key="idx" :class="{ existing: row.isExisting }">
            <td class="row-num">{{ idx + 1 }}</td>
            <td><MemberSelect v-model="row.MemberEmail" @update:modelValue="markDirty" /></td>
            <td><input v-model="row.Date" type="date" @input="markDirty"></td>
            <td><input v-model="row.Activity" type="text" @input="markDirty"></td>
            <td>
              <select v-model="row.type" @change="markDirty">
                <option value="Regular">Normal</option>
                <option value="Cleaning / Maintenance">Maintenance/Cleaning (2x)</option>
                <option value="Trial Setup / Tear Down">Trial Set Up / Tear Down (2x)</option>
              </select>
            </td>
            <td>
               <input v-model="row.clockHours" type="number" step="0.25" @input="markDirty">
            </td>
            <td><button @click="deleteRow(idx)" class="del-btn">×</button></td>
          </tr>
        </tbody>
      </table>
      <button @click="addRow" class="add-row-btn">+ Add Row</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import { useSheetsStore } from '@/stores/sheetsStore'
import MemberSelect from '@/components/admin/MemberSelect.vue'

const props = defineProps(['sheet'])
const emit = defineEmits(['saved', 'statusChange'])

const logsStore = useLogsStore()
const sheetsStore = useSheetsStore()

const rows = ref([])
const hasUnsavedChanges = ref(false)

// Load Data
watch(() => props.sheet, async (newSheet) => {
  if (hasUnsavedChanges.value && !confirm('Discard changes?')) return
  
  hasUnsavedChanges.value = false
  
  const existing = logsStore.getLogsBySheet(newSheet.shortId)
  rows.value = existing.map(l => ({
    id: l.id,
    MemberEmail: l.MemberEmail,
    Date: new Date(l.Date.toDate()).toISOString().split('T')[0],
    Activity: l.Activity,
    // Use stored clockHours if available, otherwise assume Hours was clock time
    clockHours: l.clockHours || l.Hours || 0, 
    type: l.type || 'Regular',
    isExisting: true
  }))
  
  // If no rows, add a blank one
  if (rows.value.length === 0) addRow()
}, { immediate: true })

const addRow = () => {
  const lastDate = rows.value.length > 0 ? rows.value[rows.value.length-1].Date : new Date().toISOString().split('T')[0]
  // Initialize with clockHours
  rows.value.push({ MemberEmail: '', Date: lastDate, Activity: '', clockHours: 0, type: 'Regular' })
}

const markDirty = () => hasUnsavedChanges.value = true

const deleteRow = async (idx) => {
  const row = rows.value[idx]
  if (row.id) {
    if (confirm('Delete saved entry?')) {
      await logsStore.deleteLog(row.id)
      rows.value.splice(idx, 1)
    }
  } else {
    rows.value.splice(idx, 1)
  }
}

const saveChanges = async () => {
  const toCreate = rows.value.filter(r => !r.id && r.MemberEmail)
  const toUpdate = rows.value.filter(r => r.id && r.MemberEmail)
  
  // This now calls the updated batchSave which handles the multiplier logic
  await logsStore.batchSave(toCreate, toUpdate, props.sheet.shortId)
  
  const totalCount = logsStore.getLogsBySheet(props.sheet.shortId).length + toCreate.length
  await sheetsStore.updateLogCount(props.sheet.id, totalCount)
  
  hasUnsavedChanges.value = false
  emit('saved')
  alert('Saved')
}

const toggleStatus = async () => {
  const newStatus = props.sheet.status === 'processed' ? 'pending' : 'processed'
  await sheetsStore.updateSheetStatus(props.sheet.id, newStatus)
  props.sheet.status = newStatus
  emit('statusChange')
}
</script>

<style scoped>
.data-entry {
  height: 50%; /* Fixed height for bottom half */
  display: flex;
  flex-direction: column;
  border-top: 4px solid #6366f1;
  background: white;
}

.entry-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
  color: #374151;
}

.status-toggle {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  border-radius: 0.25rem;
  cursor: pointer;
  border: 1px solid;
  font-weight: bold;
}
.status-toggle.processed {
  background: #fff;
  border-color: #d97706;
  color: #b45309;
}
.status-toggle.pending {
  background: #fff;
  border-color: #059669;
  color: #047857;
}

.save-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: bold;
  font-size: 0.875rem;
  background: #e5e7eb;
  color: #9ca3af;
  border: none;
  cursor: not-allowed;
  transition: all 0.2s;
}

.save-btn.dirty {
  background: #4f46e5;
  color: white;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
}

.table-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #6b7280;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 0.5rem 0.25rem;
  vertical-align: middle;
}

tr.existing {
  background-color: #f0f9ff;
}

input, select {
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.row-num {
  font-size: 0.75rem;
  color: #9ca3af;
  text-align: center;
}

.del-btn {
  color: #d1d5db;
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
}

.del-btn:hover {
  color: #ef4444;
}

.add-row-btn {
  width: 100%;
  margin-top: 1rem;
  padding: 0.5rem;
  border: 2px dashed #c7d2fe;
  color: #4f46e5;
  background: #e0e7ff;
  border-radius: 0.375rem;
  font-weight: bold;
  cursor: pointer;
}
</style>