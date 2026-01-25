<template>
  <div class="space-y-6 max-w-7xl mx-auto">
    
    <div class="flex justify-between items-center border-b pb-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Registrar</h1>
        <p class="text-gray-500">Manage class offerings, teachers, and rosters.</p>
      </div>
      <button 
        @click="openModal()" 
        class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2"
      >
        <span>+</span> Add Class
      </button>
    </div>

    <div v-if="classStore.loading" class="text-center py-8 text-gray-500">Loading classes...</div>
    
    <div v-else class="grid grid-cols-1 gap-4">
      <div v-for="cls in classStore.classes" :key="cls.id" class="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-lg font-bold text-gray-900">{{ cls.name }}</h3>
            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{{ cls.session }}</span>
          </div>
          <div class="text-sm text-gray-500 space-x-4">
            <span>📍 {{ cls.location }}</span>
            <span>⏰ {{ cls.time }}</span>
          </div>
          <div class="mt-2 text-xs text-gray-400">
            <strong>Teachers:</strong> {{ cls.teachers?.join(', ') || 'None' }}
          </div>
        </div>

        <div class="text-center px-4 border-l border-r border-gray-100 hidden sm:block">
          <div class="text-2xl font-bold text-indigo-600">{{ cls.students?.length || 0 }}</div>
          <div class="text-xs font-bold text-gray-400 uppercase">Students</div>
        </div>

        <div class="flex items-center gap-2">
          <button @click="openModal(cls)" class="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50">
            Edit
          </button>
          <button @click="handleDelete(cls.id)" class="text-sm border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-50">
            Delete
          </button>
        </div>
      </div>

      <div v-if="classStore.classes.length === 0" class="text-center py-10 text-gray-400 italic">
        No classes found. Click "Add Class" to start.
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b flex justify-between items-center">
          <h2 class="text-xl font-bold">{{ isEditing ? 'Edit Class' : 'New Class' }}</h2>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <div class="p-6 space-y-4">
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Class Name</label>
              <input v-model="form.name" type="text" class="w-full border rounded p-2" placeholder="e.g. Novice Barn Hunt">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Session</label>
              <select v-model="form.session" class="w-full border rounded p-2">
                <option v-for="s in classStore.sessions" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
              <select v-model="form.location" class="w-full border rounded p-2">
                <option v-for="l in classStore.locations" :key="l" :value="l">{{ l }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Time</label>
              <input v-model="form.time" type="text" class="w-full border rounded p-2" placeholder="e.g. Tuesdays 6pm">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Teachers (Emails)</label>
            <div class="flex gap-2 mb-2">
              <input v-model="newTeacher" @keyup.enter="addTeacher" type="text" class="flex-1 border rounded p-2 text-sm" placeholder="Type email and press Enter">
              <button @click="addTeacher" class="bg-gray-100 px-3 py-2 rounded border hover:bg-gray-200">Add</button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="t in form.teachers" :key="t" class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                {{ t }}
                <button @click="removeTeacher(t)" class="text-indigo-400 hover:text-red-500 font-bold">×</button>
              </span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Students (Emails)</label>
            <div class="flex gap-2 mb-2">
              <input v-model="newStudent" @keyup.enter="addStudent" type="text" class="flex-1 border rounded p-2 text-sm" placeholder="Type email and press Enter">
              <button @click="addStudent" class="bg-gray-100 px-3 py-2 rounded border hover:bg-gray-200">Add</button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="s in form.students" :key="s.email" class="bg-green-50 text-green-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                {{ s.email }}
                <button @click="removeStudent(s.email)" class="text-green-400 hover:text-red-500 font-bold">×</button>
              </span>
            </div>
          </div>

        </div>

        <div class="p-6 border-t bg-gray-50 flex justify-end gap-2">
          <button @click="closeModal" class="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
          <button @click="saveClass" class="px-4 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700">
            {{ isEditing ? 'Update Class' : 'Create Class' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useClassStore } from '@/stores/classStore'

const classStore = useClassStore()
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref(null)

const newTeacher = ref('')
const newStudent = ref('')

const form = reactive({
  name: '',
  session: '',
  location: '',
  time: '',
  teachers: [],
  students: []
})

onMounted(() => {
  classStore.initClasses()
})

// --- ACTIONS ---

const openModal = (cls = null) => {
  if (cls) {
    isEditing.value = true
    editingId.value = cls.id
    form.name = cls.name
    form.session = cls.session
    form.location = cls.location
    form.time = cls.time
    form.teachers = [...(cls.teachers || [])]
    form.students = [...(cls.students || [])]
  } else {
    isEditing.value = false
    editingId.value = null
    form.name = ''
    form.session = classStore.sessions[0]
    form.location = classStore.locations[0]
    form.time = ''
    form.teachers = []
    form.students = []
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const saveClass = async () => {
  if (!form.name) return alert('Class Name is required')

  const payload = { ...form }

  if (isEditing.value) {
    await classStore.updateClass(editingId.value, payload)
  } else {
    await classStore.addClass(payload)
  }
  closeModal()
}

const handleDelete = async (id) => {
  if (confirm('Are you sure you want to delete this class? This cannot be undone.')) {
    await classStore.deleteClass(id)
  }
}

// --- LIST HELPERS ---

const addTeacher = () => {
  if (newTeacher.value && !form.teachers.includes(newTeacher.value)) {
    form.teachers.push(newTeacher.value.toLowerCase().trim())
    newTeacher.value = ''
  }
}

const removeTeacher = (email) => {
  form.teachers = form.teachers.filter(t => t !== email)
}

const addStudent = () => {
  if (newStudent.value) {
    const email = newStudent.value.toLowerCase().trim()
    // Check dupe
    if (!form.students.find(s => s.email === email)) {
      form.students.push({ email: email, name: email }) // Name placeholder
    }
    newStudent.value = ''
  }
}

const removeStudent = (email) => {
  form.students = form.students.filter(s => s.email !== email)
}
</script>