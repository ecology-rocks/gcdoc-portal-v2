<template>
  <div class="registrar-view">
    
    <div class="page-header">
      <div class="title-section">
        <h1>Registrar</h1>
        <p>Manage class offerings, teachers, and rosters.</p>
      </div>
      <button @click="openModal()" class="btn-primary">
        <span>+</span> Add Class
      </button>
    </div>

    <div class="filter-bar">
      <span class="filter-label">Filter:</span>
      <select v-model="filterYear" class="filter-select">
        <option :value="null">All Years</option>
        <option v-for="y in classStore.availableYears" :key="y" :value="y">{{ y }}</option>
      </select>
    </div>

    <div v-if="classStore.loading" class="loading-state">Loading classes...</div>
    
    <div v-else class="class-list">
      <div v-for="cls in filteredClasses" :key="cls.id" class="class-card">
        
        <div class="card-content">
          <div class="card-header">
            <h3>{{ cls.name }}</h3>
            <span class="session-badge">
              {{ cls.year }} • {{ cls.session }}
            </span>
          </div>
          <div class="card-meta">
            <span class="meta-item">📍 {{ cls.location }}</span>
            <span class="meta-item highlight">⏰ {{ cls.day }}s @ {{ formatTime(cls.time) }}</span>
          </div>
          <div class="teachers-list">
            <strong>Teachers:</strong> {{ cls.teachers?.map(t => getMemberName(t)).join(', ') || 'None' }}
          </div>
        </div>

        <div class="card-stats">
          <div class="stat-number">{{ cls.students?.length || 0 }}</div>
          <div class="stat-label">Students</div>
        </div>

        <div class="card-actions">
          <button @click="openModal(cls)" class="btn-sm btn-outline">
            Edit
          </button>
          <button @click="handleDelete(cls.id)" class="btn-sm btn-danger">
            Delete
          </button>
        </div>
      </div>

      <div v-if="filteredClasses.length === 0" class="empty-state">
        No classes found for this filter.
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h2>{{ isEditing ? 'Edit Class' : 'New Class' }}</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          
          <div class="form-grid">
            <div class="form-group col-full sm-col-half">
              <label>Class Name</label>
              <input v-model="form.name" type="text" placeholder="e.g. Novice Barn Hunt">
            </div>
            
            <div class="form-group col-half sm-col-quarter">
              <label>Year</label>
              <select v-model="form.year">
                <option v-for="y in classStore.availableYears" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>

            <div class="form-group col-half sm-col-quarter">
              <label>Session</label>
              <select v-model="form.session">
                <option v-for="s in classStore.sessions" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div class="form-group col-full">
              <label>Location</label>
              <select v-model="form.location">
                <option v-for="l in classStore.locations" :key="l" :value="l">{{ l }}</option>
              </select>
            </div>

            <div class="form-group col-half">
              <label>Day of Week</label>
              <select v-model="form.day">
                <option v-for="d in classStore.days" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div class="form-group col-half">
              <label>Time (Start)</label>
              <input v-model="form.time" type="time">
            </div>
          </div>

          <div class="form-section">
            <label>Teachers</label>
            <div class="add-row">
              <div class="select-wrapper">
                <MemberSelect v-model="pendingTeacherEmail" />
              </div>
              <button @click="addTeacher" class="btn-add">Add</button>
            </div>
            <div class="tags-list">
              <span v-for="t in form.teachers" :key="t" class="tag tag-indigo">
                {{ getMemberName(t) }}
                <button @click="removeTeacher(t)" class="tag-remove">×</button>
              </span>
            </div>
          </div>

          <div class="form-section">
            <label>Students</label>
            <div class="add-row">
              <div class="select-wrapper">
                <MemberSelect v-model="pendingStudentEmail" />
              </div>
              <button @click="addStudent" class="btn-add">Add</button>
            </div>
            <div class="tags-list">
              <span v-for="s in form.students" :key="s.email" class="tag tag-green">
                {{ s.name }}
                <button @click="removeStudent(s.email)" class="tag-remove">×</button>
              </span>
            </div>
          </div>

        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn-cancel">Cancel</button>
          <button @click="saveClass" class="btn-primary">
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
  day: 'Monday',
  time: '',
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
    form.day = cls.day || 'Monday'
    form.time = cls.time || ''
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

<style scoped>
.registrar-view {
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
  max-width: 1200px;
  margin: 0 auto;
}

/* --- Header --- */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.title-section h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin: 0;
  color: #111827;
}

.title-section p {
  color: #6b7280;
  margin: 0.25rem 0 0 0;
  font-size: 0.95rem;
}

.btn-primary {
  background-color: #4f46e5;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.btn-primary:hover { background-color: #4338ca; }

/* --- Filter Bar --- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  background-color: #f9fafb;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
  margin-bottom: 1rem;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
}

.filter-select {
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  background-color: white;
}

/* --- Class List Cards --- */
.class-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.class-card {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
}

.card-header h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.session-badge {
  font-size: 0.75rem;
  background-color: #e0e7ff; /* Indigo 100 */
  color: #4338ca; /* Indigo 700 */
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  border: 1px solid #c7d2fe;
}

.card-meta {
  font-size: 0.875rem;
  color: #6b7280;
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.highlight {
  color: #374151;
  font-weight: 500;
}

.teachers-list {
  font-size: 0.75rem;
  color: #9ca3af;
}

.card-stats {
  text-align: center;
  padding: 0.5rem;
  background-color: #f9fafb;
  border-radius: 0.375rem;
  display: flex; /* Mobile: side by side */
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: #4f46e5;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  cursor: pointer;
  flex: 1;
}

.btn-outline {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}
.btn-outline:hover { background-color: #f9fafb; }

.btn-danger {
  background: white;
  border: 1px solid #fecaca;
  color: #dc2626;
}
.btn-danger:hover { background-color: #fef2f2; }

.empty-state {
  text-align: center;
  padding: 2.5rem;
  color: #9ca3af;
  font-style: italic;
}

/* --- Modal Styles --- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
  backdrop-filter: blur(2px);
}

.modal-container {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: #9ca3af;
  cursor: pointer;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
}

.form-group input, .form-group select {
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 0.5rem;
  font-size: 0.875rem;
  width: 100%;
  background-color: white;
}

/* Sections for Tag inputs */
.form-section {
  margin-bottom: 1rem;
}

.form-section label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.add-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.select-wrapper {
  flex: 1;
}

.btn-add {
  background-color: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 0 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: 500;
}
.btn-add:hover { background-color: #e5e7eb; }

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.tag-indigo { background-color: #e0e7ff; color: #4338ca; }
.tag-green { background-color: #dcfce7; color: #166534; }

.tag-remove {
  background: none;
  border: none;
  font-weight: 700;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
}
.tag-remove:hover { opacity: 1; }

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-cancel {
  background: none;
  border: none;
  color: #4b5563;
  padding: 0.5rem 1rem;
  cursor: pointer;
}
.btn-cancel:hover { color: #1f2937; }

/* --- Breakpoints --- */
@media (min-width: 640px) {
  /* Grid classes for modal form */
  .form-grid {
    grid-template-columns: repeat(12, 1fr);
  }
  .col-full { grid-column: span 12; }
  .col-half { grid-column: span 6; }
  .sm-col-half { grid-column: span 6; }
  .sm-col-quarter { grid-column: span 3; }
  
  /* Class List Desktop View */
  .class-card {
    flex-direction: row;
    align-items: center;
  }
  .card-content { flex: 1; }
  .card-stats { 
    border-left: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    background: transparent;
    display: block; /* Stack vertically on desktop */
    padding: 0 1.5rem;
    min-width: 100px;
  }
  .card-actions { flex-direction: row; flex: 0 0 auto; }
}
</style>