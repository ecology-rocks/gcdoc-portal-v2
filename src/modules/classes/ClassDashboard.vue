<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold text-slate-800">My Classes</h1>
      <div class="space-x-2">
         <select v-model="selectedSession" class="border rounded px-3 py-1 text-sm">
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
            <div class="text-xs text-slate-500 flex gap-2">
              <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{{ cls.session }}</span>
              <span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{{ cls.location }}</span>
              <span>{{ cls.time }}</span>
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
                   <span class="text-xs" :class="dog.vaxStatus === 'Overdue' ? 'text-red-600' : 'text-green-600'">
                     {{ dog.vaxStatus || 'No Records' }}
                   </span>
                 </div>

                 <div class="flex gap-2 mb-3">
                   <button @click="openNoteModal(dog)" class="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100">
                     断 Add Note
                   </button>
                   <button @click="openVaxModal(dog)" class="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100">
                     断 Update Vax
                   </button>
                 </div>

                 <div v-if="dog.notes?.length" class="text-xs text-slate-600 italic border-l-2 border-slate-300 pl-2">
                   "{{ dog.notes[dog.notes.length-1].text }}" 
                   <span class="text-slate-400">- {{ new Date(dog.notes[dog.notes.length-1].date.seconds * 1000).toLocaleDateString() }}</span>
                 </div>

               </div>
               <div v-if="!getDogsForStudent(student.email).length" class="text-xs text-slate-400 italic">
                 No dogs found for this student.
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
    
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useClassStore } from '@/stores/classStore'
import { useDogStore } from '@/stores/dogStore'

const classStore = useClassStore()
const dogStore = useDogStore()

const selectedSession = ref('')
const expanded = ref({})

const filteredClasses = computed(() => {
  let list = classStore.myClasses
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
    // Fetch dogs just in time
    await dogStore.fetchDogsForClass([email])
  }
}

const openNoteModal = (dog) => {
  console.log("Open note modal for", dog.name)
}

const openVaxModal = (dog) => {
  console.log("Open vax modal for", dog.name)
}

onMounted(async () => {
  await classStore.initClasses()
})
</script>