<script setup>
import { ref, watch, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import { useSheetsStore } from '@/stores/sheetsStore'
import MemberSelect from '@/components/admin/MemberSelect.vue'

const props = defineProps(['sheet'])
const emit = defineEmits(['saved', 'statusChange', 'deleted'])

const logsStore = useLogsStore()
const sheetsStore = useSheetsStore()

const rows = ref([])
const hasUnsavedChanges = ref(false)
const saving = ref(false)
const isMobile = ref(false)
// Delete is a testing aid - only shown when running the local dev server (npm run dev)
const isDev = import.meta.env.DEV

const locations = ['Northcutt', 'The Land']

// The three entry types, as one-tap buttons. Values are the stored log type strings.
const typeOptions = [
  { key: 'STANDARD', label: 'Standard', hint: '1x' },
  { key: 'MAINT', label: 'Maint', hint: '2x' },
  { key: 'SETUP', label: 'Double', hint: '2x setup/teardown' }
]

// Sheet-wide details, saved on the sheet itself
const details = reactive({
  startDate: '',
  endDate: '',
  location: '',
  notes: ''
})

// The row currently being typed. Type stays selected between entries.
const currentRow = reactive({
  MemberEmail: '',
  clockHours: '',
  type: logsStore.logType('STANDARD')
})

// 'YYYY-MM-DD' -> 'M/D/YYYY' without going through Date (avoids timezone shifts)
const formatDay = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}/${y}`
}

// "Start - End at Location (Notes)" - used as every entry's Activity
const sheetLabel = computed(() => {
  let label = formatDay(details.startDate) || 'Undated sheet'
  if (details.endDate && details.endDate !== details.startDate) label += ` - ${formatDay(details.endDate)}`
  if (details.location) label += ` at ${details.location}`
  if (details.notes.trim()) label += ` (${details.notes.trim()})`
  return label
})

// The label rows were last synced to. When the sheet details change, rows still showing this
// label follow along; rows whose Activity was edited by hand are left alone.
let appliedLabel = ''

watch(() => props.sheet, async (newSheet) => {
  if (hasUnsavedChanges.value && !confirm('Discard changes?')) return

  hasUnsavedChanges.value = false

  details.startDate = newSheet.startDate || ''
  details.endDate = newSheet.endDate || ''
  details.location = newSheet.location || ''
  details.notes = newSheet.notes || ''
  appliedLabel = sheetLabel.value

  const existing = logsStore.getLogsBySheet(newSheet.shortId)

  if (existing.length > 0) {
    rows.value = existing.map(l => ({
      id: l.id,
      MemberEmail: l.MemberEmail,
      Activity: l.Activity,
      clockHours: l.clockHours || l.Hours || 0,
      type: logsStore.logType(l.type),
      isExisting: true
    }))
  } else {
    rows.value = []
  }
}, { immediate: true })

const detailsChanged = () => {
  const newLabel = sheetLabel.value
  rows.value.forEach(row => {
    if (row.Activity === appliedLabel) row.Activity = newLabel
  })
  appliedLabel = newLabel
  markDirty()
}

const commitCurrentRow = () => {
  if (!currentRow.MemberEmail) return alert('Select a member first.')

  rows.value.push({
    MemberEmail: currentRow.MemberEmail,
    Activity: sheetLabel.value,
    type: currentRow.type,
    clockHours: parseFloat(currentRow.clockHours) || 0
  })

  // Reset just the member and hours for the next person
  currentRow.MemberEmail = ''
  currentRow.clockHours = ''
  markDirty()
}

const markDirty = () => hasUnsavedChanges.value = true

const setRowType = (row, key) => {
  row.type = logsStore.logType(key)
  markDirty()
}

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

// Returns true once everything is saved
const saveChanges = async () => {
  // Guard against overlapping saves (double-clicks, or Save Progress + Mark Done)
  if (saving.value) return false
  if (!details.startDate) {
    alert('Set the sheet Start Date first - it decides which fiscal year these hours count toward.')
    return false
  }
  if (details.endDate && details.endDate < details.startDate) {
    alert('The End Date is before the Start Date.')
    return false
  }

  saving.value = true
  try {
    // Every entry is dated by the sheet's start date, so it lands in that fiscal year
    rows.value.forEach(r => { r.Date = details.startDate })
    const toCreate = rows.value.filter(r => !r.id && r.MemberEmail)
    const toUpdate = rows.value.filter(r => r.id && r.MemberEmail)

    await sheetsStore.updateSheetDetails(props.sheet.id, { ...details })
    Object.assign(props.sheet, details)
    await logsStore.batchSave(toCreate, toUpdate, props.sheet.shortId)
    await sheetsStore.updateLogCount(props.sheet.id, getSheetLogCount())

    hasUnsavedChanges.value = false
    emit('saved')
    return true
  } finally {
    saving.value = false
  }
}

const toggleStatus = async () => {
  const newStatus = props.sheet.status === 'processed' ? 'pending' : 'processed'
  // Marking done saves any unsaved entries first, so nothing is lost
  if (newStatus === 'processed' && hasUnsavedChanges.value) {
    try {
      if (!(await saveChanges())) return
    } catch (e) {
      alert('Could not save entries, so the sheet was not marked done: ' + e.message)
      return
    }
  }
  await sheetsStore.updateSheetStatus(props.sheet.id, newStatus)
  props.sheet.status = newStatus
  emit('statusChange')
}

const deleteSheet = async () => {
  if (!confirm(`DEV: Permanently delete sheet #${props.sheet.shortId}, its image, and all ${getSheetLogCount()} of its log entries?`)) return
  await sheetsStore.deleteSheet(props.sheet)
  hasUnsavedChanges.value = false
  emit('deleted')
}

let mediaQuery = null
const syncViewportMode = () => {
  if (!mediaQuery) return
  isMobile.value = mediaQuery.matches
}

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 768px)')
  syncViewportMode()
  mediaQuery.addEventListener('change', syncViewportMode)
})

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', syncViewportMode)
})
</script>

<template>
  <div class="data-entry">
    <div class="entry-header">
      <div class="stats">
        <strong>Entries</strong>: {{ rows.length }}
        <button @click="toggleStatus" class="status-toggle" :class="sheet.status" :disabled="saving">
          {{ sheet.status === 'processed' ? '↺ Revert' : (hasUnsavedChanges ? '✓ Save & Mark Done' : '✓ Mark Done') }}
        </button>
        <button v-if="isDev" @click="deleteSheet" class="dev-delete-btn" :disabled="saving">
          🗑 Delete Sheet (dev)
        </button>
      </div>
      <button @click="saveChanges" class="save-btn" :disabled="!hasUnsavedChanges || saving"
        :class="{ dirty: hasUnsavedChanges }">
        {{ saving ? 'Saving...' : (hasUnsavedChanges ? 'Save Progress' : 'Saved') }}
      </button>
    </div>

    <div class="defaults-bar">
      <span class="defaults-label">1. Sheet Details</span>
      <div class="defaults-controls">
        <div class="form-group">
          <label>Start Date (sets fiscal year)</label>
          <input v-model="details.startDate" type="date" class="input-field" :class="{ missing: !details.startDate }" @change="detailsChanged">
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input v-model="details.endDate" type="date" class="input-field" :min="details.startDate" @change="detailsChanged">
        </div>
        <div class="form-group">
          <label>Location</label>
          <select v-model="details.location" class="input-field" @change="detailsChanged">
            <option value="">Select...</option>
            <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
          </select>
        </div>
        <div class="form-group flex-1">
          <label>Notes (optional)</label>
          <input
            v-model="details.notes"
            type="text"
            placeholder="e.g. Fixed hot water"
            class="input-field"
            @input="detailsChanged"
          />
        </div>
      </div>
      <div class="label-preview">Activity label: <strong>{{ sheetLabel }}</strong></div>
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
        
        <div class="form-group type-col">
          <label>Type (stays selected)</label>
          <div class="type-toggle">
            <button
              v-for="t in typeOptions"
              :key="t.key"
              type="button"
              :class="[t.key.toLowerCase(), { selected: currentRow.type === logsStore.logType(t.key) }]"
              :title="t.hint"
              @click="currentRow.type = logsStore.logType(t.key)"
            >{{ t.label }}</button>
          </div>
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
      <table v-else-if="!isMobile">
        <thead>
          <tr>
            <th style="width: 30px">#</th>
            <th>Member</th>
            <th>Activity</th>
            <th style="width: 210px">Type</th>
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
              <div class="type-toggle compact">
                <button
                  v-for="t in typeOptions"
                  :key="t.key"
                  type="button"
                  :class="[t.key.toLowerCase(), { selected: row.type === logsStore.logType(t.key) }]"
                  :title="t.hint"
                  @click="setRowType(row, t.key)"
                >{{ t.label }}</button>
              </div>
            </td>
            <td>
              <input v-model.number="row.clockHours" type="number" step="0.25" @input="markDirty" class="table-input text-center">
            </td>
            <td><button @click="deleteRow(idx)" class="del-btn">×</button></td>
          </tr>
        </tbody>
      </table>

      <div v-else class="mobile-cards">
        <div v-for="(row, idx) in rows" :key="idx" class="log-card" :class="{ existing: row.isExisting }">
          <div class="log-card-header">
            <strong>Entry #{{ idx + 1 }}</strong>
            <button @click="deleteRow(idx)" class="del-btn" aria-label="Delete entry">×</button>
          </div>

          <div class="log-card-field">
            <label>Member</label>
            <MemberSelect v-model="row.MemberEmail" @update:modelValue="markDirty" />
          </div>

          <div class="log-card-field">
            <label>Activity</label>
            <input v-model="row.Activity" type="text" @input="markDirty" class="table-input">
          </div>

          <div class="log-card-grid">
            <div class="log-card-field">
              <label>Type</label>
              <div class="type-toggle compact">
                <button
                  v-for="t in typeOptions"
                  :key="t.key"
                  type="button"
                  :class="[t.key.toLowerCase(), { selected: row.type === logsStore.logType(t.key) }]"
                  @click="setRowType(row, t.key)"
                >{{ t.label }}</button>
              </div>
            </div>

            <div class="log-card-field">
              <label>Hours</label>
              <input v-model.number="row.clockHours" type="number" step="0.25" @input="markDirty" class="table-input text-center">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-entry {
  display: flex;
  flex-direction: column;
  background: white;
  border-top: 4px solid #6366f1;
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
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}
.member-col { min-width: 220px; }

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

.input-field.missing { border-color: #f59e0b; background: #fffbeb; }

.label-preview {
  font-size: 0.8rem;
  color: #475569;
}

.type-col { width: auto; }

/* One-tap type picker: Standard / Maint / Double */
.type-toggle {
  display: inline-flex;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  overflow: hidden;
}
.type-toggle button {
  padding: 0 0.75rem;
  height: 38px;
  border: none;
  border-right: 1px solid #cbd5e1;
  background: white;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.type-toggle button:last-child { border-right: none; }
.type-toggle button.standard.selected { background: #4f46e5; color: white; }
.type-toggle button.maint.selected { background: #d97706; color: white; }
.type-toggle button.setup.selected { background: #7c3aed; color: white; }
.type-toggle.compact button { height: 28px; padding: 0 0.5rem; font-size: 0.75rem; }

.dev-delete-btn {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  border-radius: 0.25rem;
  border: 1px dashed #dc2626;
  background: #fef2f2;
  color: #b91c1c;
  font-weight: bold;
  cursor: pointer;
}

.max-w-xs { max-width: 200px; }
.flex-1 { flex: 1; min-width: 150px; }

/* --- Table Area --- */
.table-scroll {
  min-height: 420px;
  max-height: 62vh;
  overflow-y: auto;
  padding: 1rem;
  background: #f8fafc;
}

@media (max-width: 768px) {
  .table-scroll {
    min-height: 300px;
    max-height: 52vh;
  }
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

.mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.log-card {
  border: 1px solid #dbe3ee;
  border-radius: 0.6rem;
  padding: 0.75rem;
  background: #ffffff;
}

.log-card.existing {
  background: #f8fafc;
}

.log-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  color: #334155;
  font-size: 0.9rem;
}

.log-card-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.log-card-field label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: #64748b;
}

.log-card-grid {
  display: grid;
  grid-template-columns: 1fr 110px;
  gap: 0.5rem;
}
</style>