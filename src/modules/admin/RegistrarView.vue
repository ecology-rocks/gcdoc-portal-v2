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

    <div class="flex gap-4 items-center bg-gray-50 p-3 rounded border border-gray-200">
      <span class="text-sm font-bold text-gray-500 uppercase">Filter:</span>
      <select v-model="filterYear" class="border rounded px-2 py-1 text-sm bg-white">
        <option :value="null">All Years</option>
        <option v-for="y in classStore.availableYears" :key="y" :value="y">{{ y }}</option>
      </select>
    </div>

    <div v-if="classStore.loading" class="text-center py-8 text-gray-500">Loading classes...</div>
    
    <div v-else class="grid grid-cols-1 gap-4">
      <div v-for="cls in filteredClasses" :key="cls.id" class="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-lg font-bold text-gray-900">{{ cls.name }}</h3>
            <span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-200">
              {{ cls.year }} • {{ cls.session }}
            </span>
          </div>
          <div class="text-sm text-gray-500 space-x-4">
            <span>📍 {{ cls.location }}</span>
            <span class="font-medium text-gray-700">⏰ {{ cls.day }}s @ {{ formatTime(cls.time) }}</span>
          </div>
          <div class="mt-2 text-xs text-gray-400">
            <strong>Teachers:</strong> {{ cls.teachers?.map(t => getMemberName(t)).join(', ') || 'None' }}
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

      <div v-if="filteredClasses.length === 0" class="text-center py-10 text-gray-400 italic">
        No classes found for this filter.
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b flex justify-between items-center">
          <h2 class="text-xl font-bold">{{ isEditing ? 'Edit Class' : 'New Class' }}</h2>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <div class="p-6 space-y-4">
          
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 sm:col-span-6">
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Class Name</label>
              <input v-model="form.name" type="text" class="w-full border rounded p-2" placeholder="e.g. Novice Barn Hunt">
            </div>
            
            <div class="col-span-6 sm:col-span-3">
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Year</label>
              <select v-model="form.year" class="w-full border rounded p-2 bg-white">
                <option v-for="y in classStore.availableYears" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>

            <div class="col-span-6 sm:col-span-3">
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Session</label>
              <select v-model="form.session" class="w-full border rounded p-2 bg-white">
                <option v-for="s in classStore.sessions" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div class="col-span-12">
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
              <select v-model="form.location" class="w-full border rounded p-2 bg-white">
                <option v-for="l in classStore.locations" :key="l" :value="l">{{ l }}</option>
              </select>
            </div>

            <div class="col-span-6">
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Day of Week</label>
              <select v-model="form.day" class="w-full border rounded p-2 bg-white">
                <option v-for="d in classStore.days" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div class="col-span-6">
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Time (Start)</label>
              <input v-model="form.time" type="time" class="w-full border rounded p-2">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Teachers</label>
            <div class="flex gap-2 mb-2">
              <div class="flex-1">
                <MemberSelect v-model="pendingTeacherEmail" />
              </div>
              <button @click="addTeacher" class="bg-gray-100 px-3 py-2 rounded border hover:bg-gray-200 h-[38px] mt-[1px]">Add</button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="t in form.teachers" :key="t" class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                {{ getMemberName(t) }}
                <button @click="removeTeacher(t)" class="text-indigo-400 hover:text-red-500 font-bold ml-1">×</button>
              </span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Students</label>
            <div class="flex gap-2 mb-2">
              <div class="flex-1">
                <MemberSelect v-model="pendingStudentEmail" />
              </div>
              <button @click="addStudent" class="bg-gray-100 px-3 py-2 rounded border hover:bg-gray-200 h-[38px] mt-[1px]">Add</button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="s in form.students" :key="s.email" class="bg-green-50 text-green-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                {{ s.name }}
                <button @click="removeStudent(s.email)" class="text-green-400 hover:text-red-500 font-bold ml-1">×</button>
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
import { ref, onMounted, reactive, computed } from 'vue'
import { useClassStore } from '@/stores/classStore'
import { useMembersStore } from '@/stores/membersStore'
import MemberSelect from '@/components/admin/MemberSelect.vue'

const classStore = useClassStore()
const membersStore = useMembersStore()

const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const filterYear = ref(new Date().getFullYear())

const pendingTeacherEmail = ref('')
const pendingStudentEmail = ref('')

const form = reactive({
  name: '',
  session: '',
  year: new Date().getFullYear(),
  location: '',
  day: 'Monday', // [NEW]
  time: '',      // [NEW]
  teachers: [],
  students: []
})

onMounted(async () => {
  await classStore.initClasses()
  await membersStore.initMembers()
})

const filteredClasses = computed(() => {
  let list = classStore.classes
  if (filterYear.value) {
    list = list.filter(c => c.year === filterYear.value)
  }
  return list.sort((a, b) => a.session.localeCompare(b.session))
})

// --- ACTIONS ---

const openModal = (cls = null) => {
  pendingTeacherEmail.value = ''
  pendingStudentEmail.value = ''
  
  if (cls) {
    isEditing.value = true
    editingId.value = cls.id
    form.name = cls.name
    form.session = cls.session
    form.year = cls.year || new Date().getFullYear()
    form.location = cls.location
    form.day = cls.day || 'Monday' // [NEW]
    form.time = cls.time || ''     // [NEW]
    form.teachers = [...(cls.teachers || [])]
    form.students = [...(cls.students || [])]
  } else {
    isEditing.value = false
    editingId.value = null
    form.name = ''
    form.session = classStore.sessions[0]
    form.year = new Date().getFullYear()
    form.location = classStore.locations[0]
    form.day = 'Monday'
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

// --- HELPERS ---

const getMemberName = (email) => {
  const m = membersStore.getMemberByEmail(email)
  return m ? `${m.FirstName} ${m.LastName}` : email
}

const formatTime = (timeStr) => {
  if (!timeStr) return 'TBA'
  // Input is "18:00", convert to "6:00 PM"
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

const addTeacher = () => {
  const email = pendingTeacherEmail.value
  if (email && !form.teachers.includes(email)) {
    form.teachers.push(email)
    pendingTeacherEmail.value = ''
  }
}

const removeTeacher = (email) => {
  form.teachers = form.teachers.filter(t => t !== email)
}

const addStudent = () => {
  const email = pendingStudentEmail.value
  if (email) {
    if (!form.students.find(s => s.email === email)) {
      const m = membersStore.getMemberByEmail(email)
      const name = m ? `${m.FirstName} ${m.LastName}` : email
      form.students.push({ email: email, name: name })
    }
    pendingStudentEmail.value = ''
  }
}

const removeStudent = (email) => {
  form.students = form.students.filter(s => s.email !== email)
}
</script>