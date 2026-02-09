<template>
  <div v-if="isOpen" class="modal-backdrop">
    <div class="modal-card">
      
      <div class="modal-header">
        <h3>
          {{ dogId ? `Manage ${form.name}` : 'Add New Dog' }}
        </h3>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>

      <div v-if="dogId" class="tabs">
        <button 
          v-for="tab in ['Info', 'Vaccinations', 'Notes']" 
          :key="tab"
          @click="activeTab = tab"
          class="tab-btn"
          :class="{ active: activeTab === tab }"
        >
          {{ tab }}
        </button>
      </div>

      <div class="modal-body">
        
        <div v-if="activeTab === 'Info'" class="tab-content">
          <div class="form-grid">
            <div class="form-group">
              <label>Name</label>
              <input v-model="form.name" class="input">
            </div>
            <div class="form-group">
              <label>Breed</label>
              <input v-model="form.breed" class="input">
            </div>
            <div class="form-group">
              <label>Birthdate</label>
              <input v-model="form.birthdate" type="date" class="input">
            </div>
            <div class="form-group">
              <label>Sex</label>
              <select v-model="form.sex" class="input">
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Unknown</option>
              </select>
            </div>
          </div>
          <div class="checkbox-group">
            <input v-model="form.neutered" type="checkbox" id="neutered">
            <label for="neutered">Neutered / Spayed</label>
          </div>
        </div>

        <div v-if="activeTab === 'Vaccinations'" class="tab-content">
          <div class="info-box">
            <p>
              <strong>Date Given:</strong> When administered.<br>
              <strong>Date Due:</strong> Expiration or next booster.
            </p>
          </div>

          <div class="add-box">
            <h4>Add Record</h4>
            <div class="add-grid">
              <input v-model="newVax.name" placeholder="Vaccine Name" class="input col-full">
              <div class="date-row">
                <input v-model="newVax.dateGiven" type="date" class="input">
                <input v-model="newVax.dateDue" type="date" class="input">
                <button @click="handleAddVax" class="btn-add">Add</button>
              </div>
            </div>
          </div>

          <div class="record-list">
            <div v-for="vax in currentDog?.vaccinations" :key="vax.id" class="record-item">
              <div>
                <div class="record-title">{{ vax.name }}</div>
                <div class="record-meta">
                  Given: {{ vax.dateGiven }} | Due: <span :class="{ overdue: isOverdue(vax.dateDue) }">{{ vax.dateDue }}</span>
                </div>
              </div>
              <button @click="handleDeleteVax(vax.id)" class="btn-remove">✕</button>
            </div>
             <div v-if="!currentDog?.vaccinations?.length" class="empty-text">
              No vaccination records found.
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'Notes'" class="tab-content">
          <div class="note-input">
            <textarea v-model="newNoteText" placeholder="Add a note..." rows="2"></textarea>
            <button @click="handleAddNote" class="btn-post">Post</button>
          </div>
          <div class="note-list">
            <div v-for="note in sortedNotes" :key="note.id" class="note-item">
              <div class="note-header">
                <span class="note-author">{{ note.author }}</span>
                <div class="note-actions">
                  <span class="note-date">{{ formatNoteDate(note) }}</span>
                  <button @click="handleDeleteNote(note.id)" class="btn-remove-note">✕</button>
                </div>
              </div>
              <p class="note-text">{{ note.text }}</p>
            </div>
            <div v-if="!currentDog?.notes?.length" class="empty-text">
              No notes yet.
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-close">Close</button>
        <button v-if="activeTab === 'Info'" @click="saveInfo" class="btn-save">
          Save Dog Info
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useDogStore } from '@/stores/dogStore'

const props = defineProps({
  isOpen: Boolean,
  dogId: String,
  ownerEmail: String,
  initialTab: { type: String, default: 'Info' }
})

const emit = defineEmits(['close'])
const dogStore = useDogStore()
const activeTab = ref('Info')

const form = reactive({ name: '', breed: '', sex: 'U', birthdate: '', neutered: false })
const newVax = reactive({ name: '', dateGiven: '', dateDue: '' })
const newNoteText = ref('')

const currentDog = computed(() => dogStore.getDogById(props.dogId))

const sortedNotes = computed(() => {
  if (!currentDog.value?.notes) return []
  return [...currentDog.value.notes].sort((a, b) => {
    const da = new Date(a.timestamp || a.date || 0)
    const db = new Date(b.timestamp || b.date || 0)
    return db - da
  })
})

const formatNoteDate = (note) => {
  const val = note.timestamp || note.date
  if (!val) return 'Just now'
  const d = new Date(val)
  return isNaN(d.getTime()) ? 'Just now' : d.toLocaleString()
}

const isOverdue = (dateStr) => dateStr && new Date(dateStr) < new Date()

watch(() => props.isOpen, (val) => {
  if (val) {
    activeTab.value = props.initialTab
    if (props.dogId && currentDog.value) {
      Object.assign(form, {
        name: currentDog.value.name,
        breed: currentDog.value.breed,
        sex: currentDog.value.sex || 'U',
        birthdate: currentDog.value.birthdate || '',
        neutered: !!currentDog.value.neutered
      })
    } else {
      Object.assign(form, { name: '', breed: '', sex: 'U', birthdate: '', neutered: false })
    }
  }
})

const saveInfo = async () => {
  if (!form.name) return alert("Name is required")
  const payload = { ...form, ownerId: props.ownerEmail }
  if (props.dogId) {
    await dogStore.updateDog(props.dogId, payload)
  } else {
    await dogStore.addDog(payload)
    emit('close')
  }
}

const handleAddVax = async () => {
  if (!newVax.name || !newVax.dateGiven) return alert("Info missing")
  await dogStore.addVaccination(props.dogId, { ...newVax })
  Object.assign(newVax, { name: '', dateGiven: '', dateDue: '' })
}

const handleDeleteVax = async (id) => {
  if(confirm("Remove?")) await dogStore.deleteVaccination(props.dogId, id)
}

const handleAddNote = async () => {
  if (!newNoteText.value.trim()) return
  await dogStore.addNote(props.dogId, newNoteText.value)
  newNoteText.value = ''
}

const handleDeleteNote = async (id) => {
  if(confirm("Delete note?")) await dogStore.deleteNote(props.dogId, id)
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
  backdrop-filter: blur(2px);
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}

.modal-card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.modal-header {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  background-color: #f9fafb;
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #9ca3af;
  cursor: pointer;
  line-height: 1;
}

/* Tabs */
.tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
}

.tab-btn {
  flex: 1;
  padding: 0.75rem;
  background: white;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
}

.tab-btn:hover { color: #374151; }
.tab-btn.active { border-bottom-color: #4f46e5; color: #4f46e5; }

/* Body */
.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Forms */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Vax Tab */
.info-box {
  background-color: #eff6ff;
  border-left: 4px solid #60a5fa;
  padding: 1rem;
}
.info-box p { margin: 0; font-size: 0.875rem; color: #1d4ed8; }

.add-box {
  background-color: #f9fafb;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
}

.add-box h4 {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.add-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.date-row {
  display: flex;
  gap: 0.5rem;
}

.btn-add {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
}

.record-title { font-weight: 700; font-size: 0.875rem; color: #1f2937; }
.record-meta { font-size: 0.75rem; color: #6b7280; }
.overdue { color: #dc2626; font-weight: 700; }

.btn-remove { color: #f87171; background: none; border: none; font-weight: 700; cursor: pointer; }
.btn-remove:hover { color: #dc2626; }

/* Notes Tab */
.note-input {
  display: flex;
  gap: 0.5rem;
}

.note-input textarea {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  resize: vertical;
}

.btn-post {
  background-color: #4f46e5;
  color: white;
  border: none;
  padding: 0 1rem;
  border-radius: 0.25rem;
  font-weight: 700;
  cursor: pointer;
}

.note-list { display: flex; flex-direction: column; gap: 1rem; }

.note-item {
  background-color: #f9fafb;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
}

.note-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.note-author { font-size: 0.75rem; font-weight: 700; color: #4f46e5; }
.note-actions { display: flex; align-items: center; gap: 0.5rem; }
.note-date { font-size: 0.65rem; color: #9ca3af; }
.btn-remove-note { background: none; border: none; color: #9ca3af; font-size: 0.75rem; cursor: pointer; }

.note-text { margin: 0; font-size: 0.875rem; color: #1f2937; white-space: pre-wrap; }

.empty-text { text-align: center; color: #9ca3af; font-style: italic; font-size: 0.875rem; }

/* Footer */
.modal-footer {
  padding: 1rem;
  background-color: #f9fafb;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}

.btn-close {
  background: none;
  border: none;
  color: #4b5563;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-save {
  background-color: #16a34a;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
}
.btn-save:hover { background-color: #15803d; }
</style>