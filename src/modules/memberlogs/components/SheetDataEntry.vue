<script setup>
import { ref, watch, reactive, computed } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import { useSheetsStore } from '@/stores/sheetsStore'
import MemberSelect from '@/components/admin/MemberSelect.vue'

const props = defineProps(['sheet'])
const emit = defineEmits(['saved', 'statusChange'])

const logsStore = useLogsStore()
const sheetsStore = useSheetsStore()

const rows = ref([])
const hasUnsavedChanges = ref(false)
const sports = ['Agility', 'Barn Hunt', 'Conformation', 'Rally', 'Obedience', 'Freestyle', 'Coursing', 'Other']

// Quick-select defaults
const defaultSettings = reactive({
  category: 'STANDARD',
  sport: '',
  notes: ''
})

// The row currently being typed
const currentRow = reactive({
  MemberEmail: '',
  clockHours: ''
})

watch(() => props.sheet, async (newSheet) => {
  if (hasUnsavedChanges.value && !confirm('Discard changes?')) return

  hasUnsavedChanges.value = false

  const existing = logsStore.getLogsBySheet(newSheet.shortId)
  
  if (existing.length > 0) {
    rows.value = existing.map(l => ({
      id: l.id,
      MemberEmail: l.MemberEmail,
      Date: new Date(l.Date.toDate()).toISOString().split('T')[0],
      Activity: l.Activity,
      clockHours: l.clockHours || l.Hours || 0, 
      type: logsStore.logType(l.type), 
      isExisting: true
    }))
  } else {
    rows.value = []
  }
}, { immediate: true })

const compiledDefaults = computed(() => {
  const cat = defaultSettings.category
  const typeString = logsStore.logType(cat)
  let act = defaultSettings.notes || ''

  if (cat === 'MAINT') {
    act = act || 'Cleaning / Maintenance'
  } else if (cat === 'SETUP') {
    act = act ? `Trial Setup - ${defaultSettings.sport} (${act})` : `Trial Setup - ${defaultSettings.sport}`
  } else if (cat === 'PRACTICE') {
    act = act ? `Practices - ${defaultSettings.sport} (${act})` : `Practices - ${defaultSettings.sport}`
  } else if (cat === 'ADMIN') {
    act = act ? `Meetings and Admin (${act})` : `Meetings and Admin`
  } else if (cat === 'STANDARD') {
    act = act || 'Standard Volunteer Work'
  } else {
    act = act || 'Other Volunteer Work'
  }

  return { activity: act, type: typeString }
})

const commitCurrentRow = () => {
  if (!currentRow.MemberEmail) return alert('Select a member first.')
  
  rows.value.push({
    MemberEmail: currentRow.MemberEmail,
    Date: new Date().toISOString().split('T')[0],
    Activity: compiledDefaults.value.activity,
    type: compiledDefaults.value.type,
    clockHours: parseFloat(currentRow.clockHours) || 0
  })

  // Reset just the entry fields for the next person
  currentRow.MemberEmail = ''
  currentRow.clockHours = ''
  markDirty()
}

const markDirty = () => hasUnsavedChanges.value = true

const getSheetLogCount = () => rows.value.filter(row => row.MemberEmail).length

const deleteRow = async (idx) => {
  const row = rows.value[idx]
  if (row.id) {
    if (confirm('Delete saved entry?')) {
      await logsStore.deleteLog(row.id)
      rows.value.splice(idx, 1)
      await sheetsStore.updateLogCount(props.sheet.id, getSheetLogCount())
    }
  } else {
    rows.value.splice(idx, 1)
  }
}

const saveChanges = async () => {
  const toCreate = rows.value.filter(r => !r.id && r.MemberEmail)
  const toUpdate = rows.value.filter(r => r.id && r.MemberEmail)

  await logsStore.batchSave(toCreate, toUpdate, props.sheet.shortId)
  await sheetsStore.updateLogCount(props.sheet.id, getSheetLogCount())

  hasUnsavedChanges.value = false
  emit('saved')
}

const toggleStatus = async () => {
  const newStatus = props.sheet.status === 'processed' ? 'pending' : 'processed'
  await sheetsStore.updateSheetStatus(props.sheet.id, newStatus)
  props.sheet.status = newStatus
  emit('statusChange')
}
</script>

<template>
  <div class="data-entry">
    <div class="entry-header">
      <div class="stats">
        <strong>Entries</strong>: {{ rows.length }}
        <button @click="toggleStatus" class="status-toggle" :class="sheet.status">
          {{ sheet.status === 'processed' ? '↺ Revert' : '✓ Mark Done' }}
        </button>
      </div>
      <button @click="saveChanges" class="save-btn" :disabled="!hasUnsavedChanges"
        :class="{ dirty: hasUnsavedChanges }">
        {{ hasUnsavedChanges ? 'Save Progress' : 'Saved' }}
      </button>
    </div>

    <div class="defaults-bar">
      <span class="defaults-label">1. Set Activity Details</span>
      <div class="defaults-controls">
        <select v-model="defaultSettings.category" class="input-field max-w-xs">
          <option value="STANDARD">Standard (1x)</option>
          <option value="MAINT">🧹 Maintenance (2x)</option>
          <option value="SETUP">🏗️ Trial Setup (2x)</option>
          <option value="PRACTICE">🐕 Practices (1x)</option>
          <option value="ADMIN">📝 Admin/Meetings (1x)</option>
          <option value="OTHER">❓ Other (1x)</option>
        </select>
        
        <select 
          v-if="['SETUP', 'PRACTICE'].includes(defaultSettings.category)" 
          v-model="defaultSettings.sport" 
          class="input-field max-w-xs"
        >
          <option value="">Select Sport...</option>
          <option v-for="s in sports" :key="s" :value="s">{{ s }}</option>
        </select>

        <input 
          v-model="defaultSettings.notes" 
          type="text" 
          placeholder="Notes (e.g. Fixed hot water)" 
          class="input-field flex-1"
        />
      </div>
    </div>

    <div class="active-entry-box">
      <span class="defaults-label">2. Add Member Entry</span>
      <div class="entry-grid">
        <div class="form-group member-col">
          <label>Member Name</label>
          <MemberSelect v-model="currentRow.MemberEmail" />
        </div>
        
        <div class="form-group hours-col">
          <label>Hours</label>
          <input 
            v-model.number="currentRow.clockHours" 
            type="number" 
            step="1" 
            class="input-field hours-input"
            @keyup.enter="commitCurrentRow"
          >
        </div>
        
        <div class="form-group btn-col">
          <button @click="commitCurrentRow" class="add-btn" :disabled="!currentRow.MemberEmail">
            + Add Row
          </button>
        </div>
      </div>
    </div>

    <div class="table-scroll">
      <div v-if="rows.length === 0" class="empty-state">No entries logged yet.</div>
      <table v-else>
        <thead>
          <tr>
            <th style="width: 30px">#</th>
            <th>Member</th>
            <th>Activity</th>
            <th style="width: 150px">Type</th>
            <th style="width: 60px; text-align: center;">Hrs</th>
            <th style="width: 30px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in rows" :key="idx" :class="{ existing: row.isExisting }">
            <td class="row-num">{{ idx + 1 }}</td>
            <td>
              <MemberSelect v-model="row.MemberEmail" @update:modelValue="markDirty" />
            </td>
            <td><input v-model="row.Activity" type="text" @input="markDirty" class="table-input"></td>
            <td>
              <select v-model="row.type" @change="markDirty" class="table-input">
                <option :value="logsStore.logType('STANDARD')">Normal (1x)</option>
                <option :value="logsStore.logType('MAINT')">Maint (2x)</option>
                <option :value="logsStore.logType('SETUP')">Setup (2x)</option>
              </select>
            </td>
            <td>
              <input v-model.number="row.clockHours" type="number" step="0.25" @input="markDirty" class="table-input text-center">
            </td>
            <td><button @click="deleteRow(idx)" class="del-btn">×</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.data-entry {
  display: flex;
  flex-direction: column;
  background: white;
  border-top: 4px solid #6366f1;
  /* Fixed height to ensure the table scrolls internally while keeping entry form visible */
  height: 45vh; 
  min-height: 400px;
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
.status-toggle.processed { background: #fff; border-color: #d97706; color: #b45309; }
.status-toggle.pending { background: #fff; border-color: #059669; color: #047857; }

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

/* --- Settings & Entry Areas --- */
.defaults-bar {
  background: #f1f5f9;
  border-bottom: 1px solid #cbd5e1;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.active-entry-box {
  background: #ffffff;
  border-bottom: 2px solid #e5e7eb;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 4px 6px -4px rgba(0,0,0,0.1);
  z-index: 10;
}

.defaults-label {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #4f46e5;
}

.defaults-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.entry-grid {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.member-col { flex: 1; }
.hours-col { width: 100px; }
.btn-col { width: 120px; }

.input-field {
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.95rem;
}
.input-field:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.hours-input {
  text-align: center;
  font-weight: bold;
  font-size: 1.1rem;
}

.add-btn {
  padding: 0.5rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: bold;
  font-size: 0.95rem;
  cursor: pointer;
  height: 38px;
}
.add-btn:disabled { background: #94a3b8; cursor: not-allowed; }

.max-w-xs { max-width: 200px; }
.flex-1 { flex: 1; min-width: 150px; }

/* --- Table Area --- */
.table-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #f8fafc;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #94a3b8;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

td {
  padding: 0.25rem 0.25rem;
  vertical-align: middle;
  border-bottom: 1px solid #f1f5f9;
}

tr.existing td { background-color: #f8fafc; }

.table-input {
  width: 100%;
  padding: 0.25rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  font-size: 0.85rem;
  background: transparent;
}
.table-input:focus { border-color: #cbd5e1; background: white; }

.text-center { text-align: center; }

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
.del-btn:hover { color: #ef4444; }

.empty-state {
  text-align: center;
  color: #94a3b8;
  font-style: italic;
  padding: 2rem;
}
</style>