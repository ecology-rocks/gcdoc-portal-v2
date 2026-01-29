<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold text-slate-800">My Classes</h1>
      <div class="space-x-2 flex">
         <select v-model="selectedYear" class="border rounded px-3 py-1 text-sm bg-white">
           <option v-for="y in classStore.availableYears" :key="y" :value="y">{{ y }}</option>
         </select>
         <select v-model="selectedSession" class="border rounded px-3 py-1 text-sm bg-white">
           <option value="">All Sessions</option>
           <option v-for="s in classStore.sessions" :key="s" :value="s">{{ s }}</option>
         </select>
      </div>
    </div>

    <div v-if="classStore.loading" class="text-slate-500">Loading classes...</div>
    
    <div v-else class="grid gap-6">
      <div v-for="cls in filteredClasses" :key="cls.id" class="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        
        <div class="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 class="font-bold text-lg text-slate-700">{{ cls.name }}</h3>
            <div class="text-xs text-slate-500 flex gap-2 mt-1">
              <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold">
                {{ cls.year }} • {{ cls.session }}
              </span>
              <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">{{ cls.location }}</span>
              <span class="px-1 font-medium">{{ cls.day }}s @ {{ formatTime(cls.time) }}</span>
            </div>
          </div>
          <span class="text-xs font-bold text-slate-400">
            {{ cls.students?.length || 0 }} Students
          </span>
        </div>

        <div class="divide-y divide-slate-100">
          <div v-for="student in cls.students" :key="student.email" class="p-4 hover:bg-slate-50 transition-colors">
            <div class="flex justify-between items-start mb-2">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                  {{ (student.name?.[0] || '?').toUpperCase() }}
                </div>
                <div>
                  <p class="text-sm font-medium text-slate-900">{{ student.name }}</p>
                  <p class="text-xs text-slate-500">{{ student.email }}</p>
                </div>
              </div>
              <button 
                @click="toggleExpand(student.email)"
                class="text-xs text-indigo-600 hover:text-indigo-800 underline"
              >
                {{ expanded[student.email] ? 'Hide Dogs' : 'Show Dogs' }}
              </button>
            </div>

            <div v-if="expanded[student.email]" class="mt-4 pl-11 space-y-4">
               <div v-for="dog in getDogsForStudent(student.email)" :key="dog.id" class="bg-slate-50 p-3 rounded border border-slate-200 text-sm">
                 
                 <div class="flex justify-between mb-2">
                   <span class="font-bold text-slate-700">{{ dog.name }} <span class="font-normal text-slate-500">({{ dog.breed }})</span></span>
                   <div class="flex gap-2">
                        <span v-if="dog.vaccinations?.length" class="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded">Vax OK</span>
                        <span v-else class="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded">No Vax</span>
                    </div>
                 </div>

                 <div class="flex gap-2 mb-3">
                   <button @click="openNoteModal(dog, student.email)" class="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1">
                     📝 Add Note
                   </button>
                 </div>

                 <div v-if="dog.notes?.length" class="text-xs text-slate-600 italic border-l-2 border-slate-300 pl-2">
                   "{{ dog.notes[dog.notes.length-1].text }}" 
                   <span class="text-slate-400">- {{ formatDate(dog.notes[dog.notes.length-1].timestamp) }}</span>
                 </div>

               </div>
               <div v-if="!getDogsForStudent(student.email).length" class="text-xs text-slate-400 italic">
                 No dogs found for this student.
               </div>
            </div>

          </div>
        </div>
      </div>

      <div v-if="filteredClasses.length === 0" class="text-center py-12 text-slate-400 italic border-2 border-dashed border-slate-200 rounded-lg">
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

// Modal State
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

// [UPDATED] Open the Modal instead of Prompt
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