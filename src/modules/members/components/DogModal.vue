<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      
      <div class="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
        <h3 class="font-bold text-lg text-gray-800">
          {{ dogId ? `Manage ${form.name}` : 'Add New Dog' }}
        </h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl">×</button>
      </div>

      <div v-if="dogId" class="flex border-b">
        <button 
          v-for="tab in ['Info', 'Vaccinations', 'Notes']" 
          :key="tab"
          @click="activeTab = tab"
          class="flex-1 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
        >
          {{ tab }}
        </button>
      </div>

      <div class="p-6 overflow-y-auto flex-1">
        
        <div v-if="activeTab === 'Info'" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
              <input v-model="form.name" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Breed</label>
              <input v-model="form.breed" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Birthdate</label>
              <input v-model="form.birthdate" type="date" class="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Sex</label>
              <select v-model="form.sex" class="w-full border p-2 rounded bg-white">
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Unknown</option>
              </select>
            </div>
          </div>
          <div class="flex items-center gap-2 pt-2">
            <input v-model="form.neutered" type="checkbox" id="neutered" class="w-4 h-4 text-indigo-600 rounded">
            <label for="neutered" class="text-sm text-gray-700">Neutered / Spayed</label>
          </div>
        </div>

        <div v-if="activeTab === 'Vaccinations'" class="space-y-6">
          <div class="bg-blue-50 border-l-4 border-blue-400 p-4">
            <p class="text-sm text-blue-700">
              <span class="font-bold">Date Given:</span> When administered.<br>
              <span class="font-bold">Date Due:</span> Expiration or next booster.
            </p>
          </div>

          <div class="bg-gray-50 p-4 rounded border border-gray-200 space-y-3">
            <h4 class="text-xs font-bold text-gray-800 uppercase">Add Record</h4>
            <div class="grid grid-cols-3 gap-2">
              <input v-model="newVax.name" placeholder="Vaccine Name" class="border rounded p-2 text-sm col-span-3 sm:col-span-1">
              <div class="col-span-3 sm:col-span-2 flex gap-2">
                <input v-model="newVax.dateGiven" type="date" class="border rounded p-2 text-sm flex-1">
                <input v-model="newVax.dateDue" type="date" class="border rounded p-2 text-sm flex-1">
                <button @click="handleAddVax" class="bg-blue-600 text-white px-3 py-2 rounded font-bold text-sm">Add</button>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div v-for="vax in currentDog?.vaccinations" :key="vax.id" class="flex justify-between items-center p-3 bg-white border rounded">
              <div>
                <div class="font-bold text-gray-800">{{ vax.name }}</div>
                <div class="text-xs text-gray-500">
                  Given: {{ vax.dateGiven }} | Due: <span :class="isOverdue(vax.dateDue) ? 'text-red-600 font-bold' : 'text-green-600'">{{ vax.dateDue }}</span>
                </div>
              </div>
              <button @click="handleDeleteVax(vax.id)" class="text-red-400 hover:text-red-600 font-bold px-2">✕</button>
            </div>
             <div v-if="!currentDog?.vaccinations?.length" class="text-center text-sm text-gray-400 italic py-4">
              No vaccination records found.
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'Notes'" class="space-y-6">
          <div class="flex gap-2">
            <textarea v-model="newNoteText" placeholder="Add a note..." class="flex-1 border rounded p-2 text-sm" rows="2"></textarea>
            <button @click="handleAddNote" class="bg-indigo-600 text-white px-4 rounded font-bold">Post</button>
          </div>
          <div class="space-y-4">
            <div v-for="note in sortedNotes" :key="note.id" class="bg-gray-50 p-3 rounded border border-gray-200">
              <div class="flex justify-between items-start mb-1">
                <span class="text-xs font-bold text-indigo-600">{{ note.author }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-gray-400">{{ formatNoteDate(note) }}</span>
                  <button @click="handleDeleteNote(note.id)" class="text-gray-400 hover:text-red-600 text-xs">✕</button>
                </div>
              </div>
              <p class="text-sm text-gray-800 whitespace-pre-wrap">{{ note.text }}</p>
            </div>
            <div v-if="!currentDog?.notes?.length" class="text-center text-sm text-gray-400 italic py-4">
              No notes yet.
            </div>
          </div>
        </div>
      </div>

      <div class="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-lg">
        <button @click="$emit('close')" class="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">Close</button>
        <button v-if="activeTab === 'Info'" @click="saveInfo" class="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 text-sm">
          Save Dog Info
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useDogStore } from '@/stores/dogStore'

const props = defineProps({
  isOpen: Boolean,
  dogId: String,    // If editing existing
  ownerEmail: String // If creating new
})

const emit = defineEmits(['close'])

const dogStore = useDogStore()
const activeTab = ref('Info')

// Form State
const form = reactive({ name: '', breed: '', sex: 'U', birthdate: '', neutered: false })
const newVax = reactive({ name: '', dateGiven: '', dateDue: '' })
const newNoteText = ref('')

// Helpers
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

// Initialize Form
watch(() => props.isOpen, (val) => {
  if (val) {
    activeTab.value = 'Info'
    if (props.dogId && currentDog.value) {
      // Edit Mode
      Object.assign(form, {
        name: currentDog.value.name,
        breed: currentDog.value.breed,
        sex: currentDog.value.sex || 'U',
        birthdate: currentDog.value.birthdate || '',
        neutered: !!currentDog.value.neutered
      })
    } else {
      // Create Mode
      Object.assign(form, { name: '', breed: '', sex: 'U', birthdate: '', neutered: false })
    }
  }
})

// Actions
const saveInfo = async () => {
  if (!form.name) return alert("Name is required")
  const payload = { ...form, ownerId: props.ownerEmail }

  if (props.dogId) {
    await dogStore.updateDog(props.dogId, payload)
  } else {
    await dogStore.addDog(payload)
    emit('close') // Close on create
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