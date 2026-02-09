<template>
  <div class="class-dashboard">
    <div class="dashboard-header">
      <h1>My Classes</h1>
      <div class="filters">
         <select v-model="selectedYear" class="filter-select">
           <option v-for="y in classStore.availableYears" :key="y" :value="y">{{ y }}</option>
         </select>
         <select v-model="selectedSession" class="filter-select">
           <option value="">All Sessions</option>
           <option v-for="s in classStore.sessions" :key="s" :value="s">{{ s }}</option>
         </select>
      </div>
    </div>

    <div v-if="classStore.loading" class="loading-state">Loading classes...</div>
    
    <div v-else class="classes-grid">
      <div v-for="cls in filteredClasses" :key="cls.id" class="class-card">
        
        <div class="card-header">
          <div class="header-info">
            <h3>{{ cls.name }}</h3>
            <div class="badges">
              <span class="badge badge-indigo">
                {{ cls.year }} • {{ cls.session }}
              </span>
              <span class="badge badge-emerald">{{ cls.location }}</span>
              <span class="schedule-text">{{ cls.day }}s @ {{ formatTime(cls.time) }}</span>
            </div>
          </div>
          <span class="student-count">
            {{ cls.students?.length || 0 }} Students
          </span>
        </div>

        <div class="student-list">
          <div v-for="student in cls.students" :key="student.email" class="student-row">
            <div class="student-main">
              <div class="student-info">
                <div class="avatar">
                  {{ (student.name?.[0] || '?').toUpperCase() }}
                </div>
                <div>
                  <p class="student-name">{{ student.name }}</p>
                  <p class="student-email">{{ student.email }}</p>
                </div>
              </div>
              <button 
                @click="toggleExpand(student.email)"
                class="btn-toggle"
              >
                {{ expanded[student.email] ? 'Hide Dogs' : 'Show Dogs' }}
              </button>
            </div>

            <div v-if="expanded[student.email]" class="dog-section">
               <div v-for="dog in getDogsForStudent(student.email)" :key="dog.id" class="dog-card">
                 
                 <div class="dog-header">
                   <span class="dog-name">{{ dog.name }} <span class="dog-breed">({{ dog.breed }})</span></span>
                   <div class="vax-status">
                        <span v-if="dog.vaccinations?.length" class="tag tag-green">Vax OK</span>
                        <span v-else class="tag tag-red">No Vax</span>
                    </div>
                 </div>

                 <div class="dog-actions">
                   <button @click="openNoteModal(dog, student.email)" class="btn-note">
                     📝 Add Note
                   </button>
                 </div>

                 <div v-if="dog.notes?.length" class="dog-note-preview">
                   "{{ dog.notes[dog.notes.length-1].text }}" 
                   <span class="note-date">- {{ formatDate(dog.notes[dog.notes.length-1].timestamp) }}</span>
                 </div>

               </div>
               <div v-if="!getDogsForStudent(student.email).length" class="empty-dogs">
                 No dogs found for this student.
               </div>
            </div>

          </div>
        </div>
      </div>

      <div v-if="filteredClasses.length === 0" class="empty-state">
        No classes found for {{ selectedYear }} / {{ selectedSession || 'All Sessions' }}.
      </div>
    </div>

    <DogModal 
      :is-open="isDogModalOpen"
      :dog-id="selectedDogId"
      :owner-email="selectedOwnerEmail"
      initial-tab="Notes" 
      @close="isDogModalOpen = false"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useClassStore } from '@/stores/classStore'
import { useDogStore } from '@/stores/dogStore'
import DogModal from '@/modules/members/components/DogModal.vue'

const classStore = useClassStore()
const dogStore = useDogStore()

const selectedYear = ref(new Date().getFullYear())
const selectedSession = ref('')
const expanded = ref({})

const isDogModalOpen = ref(false)
const selectedDogId = ref(null)
const selectedOwnerEmail = ref(null)

const filteredClasses = computed(() => {
  let list = classStore.myClasses
  
  if (selectedYear.value) {
    list = list.filter(c => (c.year || new Date().getFullYear()) === selectedYear.value)
  }

  if (selectedSession.value) {
    list = list.filter(c => c.session === selectedSession.value)
  }
  return list
})

const getDogsForStudent = (email) => {
  return dogStore.getDogsByOwner(email)
}

const toggleExpand = async (email) => {
  expanded.value[email] = !expanded.value[email]
  if (expanded.value[email]) {
    await dogStore.fetchDogsForOwner(email)
  }
}

const openNoteModal = (dog, ownerEmail) => {
  selectedDogId.value = dog.id
  selectedOwnerEmail.value = ownerEmail
  isDogModalOpen.value = true
}

const formatTime = (timeStr) => {
  if (!timeStr) return 'TBA'
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${m} ${ampm}`
}

const formatDate = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return isNaN(d) ? '' : d.toLocaleDateString()
}

onMounted(async () => {
  await classStore.initClasses()
})
</script>

<style scoped>
.class-dashboard {
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
  max-width: 1000px;
  margin: 0 auto;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.dashboard-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.filters {
  display: flex;
  gap: 0.5rem;
}

.filter-select {
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  background-color: white;
}

.loading-state {
  color: #6b7280;
  font-style: italic;
}

/* Class Cards */
.classes-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.class-card {
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.card-header {
  padding: 1rem;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-info h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #374151;
  margin: 0 0 0.25rem 0;
}

.badges {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  border-width: 1px;
  border-style: solid;
  font-weight: 700;
}

.badge-indigo {
  background-color: #e0e7ff;
  color: #4338ca;
  border-color: #c7d2fe;
}

.badge-emerald {
  background-color: #d1fae5;
  color: #047857;
  border-color: #a7f3d0;
}

.schedule-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
}

.student-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: #9ca3af;
}

/* Student List */
.student-row {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
}

.student-row:hover {
  background-color: #f9fafb;
}

.student-row:last-child {
  border-bottom: none;
}

.student-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.student-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 2rem;
  height: 2rem;
  background-color: #e5e7eb;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #4b5563;
}

.student-name {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.student-email {
  margin: 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.btn-toggle {
  background: none;
  border: none;
  font-size: 0.75rem;
  color: #4f46e5;
  text-decoration: underline;
  cursor: pointer;
}
.btn-toggle:hover { color: #312e81; }

/* Dog Section */
.dog-section {
  margin-top: 1rem;
  padding-left: 2.75rem; /* Indent to align with text */
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dog-card {
  background-color: #f9fafb;
  padding: 0.75rem;
  border-radius: 0.25rem;
  border: 1px solid #e5e7eb;
}

.dog-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.dog-name {
  font-weight: 700;
  font-size: 0.875rem;
  color: #374151;
}

.dog-breed {
  font-weight: normal;
  color: #6b7280;
}

.tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
}
.tag-green { background-color: #dcfce7; color: #166534; }
.tag-red { background-color: #fee2e2; color: #991b1b; }

.btn-note {
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 2px 6px;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.btn-note:hover { background-color: #f3f4f6; }

.dog-note-preview {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: #4b5563;
  font-style: italic;
  border-left: 2px solid #d1d5db;
  padding-left: 0.5rem;
}

.note-date { color: #9ca3af; }

.empty-dogs {
  font-size: 0.75rem;
  color: #9ca3af;
  font-style: italic;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-style: italic;
  border: 2px dashed #e5e7eb;
  border-radius: 0.5rem;
}
</style>