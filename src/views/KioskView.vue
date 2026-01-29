<template>
  <div class="kiosk-layout">
    <div class="check-in-panel">
      <header class="mb-6">
        <h1 class="text-3xl font-bold text-indigo-900">Volunteer Check-In</h1>
        <p class="text-gray-600">Gem City Dog Obedience Club</p>
      </header>

      <div v-if="step === 1">
        <label class="block text-lg font-bold mb-2">Who are you?</label>
        <input 
          v-model="search" 
          placeholder="Start typing your name..." 
          class="kiosk-input"
          autofocus
        />
        <div class="space-y-2 mt-4">
          <button 
            v-for="m in filteredMembers" 
            :key="m.id" 
            @click="selectMember(m)"
            class="member-btn"
          >
            <span class="font-bold">{{ m.LastName }}</span>, {{ m.FirstName }}
          </button>
        </div>
      </div>

      <div v-if="step === 2">
        <div class="mb-4 text-xl">
          Hi, <strong>{{ selectedMember.FirstName }}</strong>!
          <button @click="resetWizard" class="text-sm text-red-500 underline ml-2">(Not you?)</button>
        </div>
        
        <label class="block text-lg font-bold mb-2">What are you doing today?</label>
        <div class="grid grid-cols-1 gap-3">
          <button @click="selectCategory('MAINT')" class="activity-btn maint">🧹 Cleaning / Maintenance</button>
          <button @click="selectCategory('SETUP')" class="activity-btn setup">🏗️ Trial Setup / Teardown</button>
          <button @click="selectCategory('PRACTICE')" class="activity-btn">🐕 Practices / Runthroughs</button>
          <button @click="selectCategory('ADMIN')" class="activity-btn">📝 Admin / Meetings</button>
          <button @click="selectCategory('OTHER')" class="activity-btn">❓ Other</button>
        </div>
      </div>

      <div v-if="step === 3">
        <button @click="step = 2" class="text-gray-500 mb-2">← Back</button>
        <label class="block text-lg font-bold mb-2">Which Sport?</label>
        <div class="grid grid-cols-2 gap-3">
          <button v-for="s in sports" :key="s" @click="selectSport(s)" class="activity-btn">
            {{ s }}
          </button>
        </div>
      </div>

      <div v-if="step === 4">
        <button @click="step = 2" class="text-gray-500 mb-2">← Back</button>
        <h3 class="text-xl font-bold mb-4">How do you want to log time?</h3>
        
        <button @click="doCheckIn" class="action-btn primary mb-3">
          ⏱️ Check In Now
          <span class="block text-sm font-normal opacity-80">I am starting my shift</span>
        </button>

        <button @click="step = 5" class="action-btn secondary">
          📝 Enter Past Hours
          <span class="block text-sm font-normal opacity-80">I already finished the work</span>
        </button>
      </div>

      <div v-if="step === 5">
        <label class="block text-lg font-bold mb-2">Enter Actual Hours Worked</label>
        <input v-model.number="manualHours" type="number" step="0.25" class="kiosk-input mb-4" placeholder="e.g. 2.5" />
        <button @click="doManualEntry" class="action-btn primary" :disabled="!manualHours">Submit Log</button>
        <button @click="step = 4" class="text-center w-full mt-4 text-gray-500">Cancel</button>
      </div>
    </div>

    <div class="active-panel">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">Active Volunteers ({{ activeSessions.length }})</h2>
      
      <div v-if="activeSessions.length === 0" class="text-gray-400 italic text-center mt-10">
        No one is currently checked in.
      </div>

      <div class="session-list">
        <div v-for="session in activeSessions" :key="session.id" class="session-card">
          <div class="flex-1">
            <div class="font-bold text-lg text-indigo-700">{{ session.MemberName }}</div>
            <div class="text-sm text-gray-600">{{ session.Activity }}</div>
            <span v-if="session.Sport" class="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-700">{{ session.Sport }}</span>
            <div class="text-xs text-gray-400 mt-1">
              Started: {{ formatTime(session.Date) }}
            </div>
          </div>
          <button @click="confirmSignOut(session)" class="sign-out-btn">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const membersStore = useMembersStore()
const logsStore = useLogsStore()

// --- CONSTANTS MATCHING LOG HISTORY ---
const TYPES = {
  MAINT: "Cleaning / Maintenance (2x + Blue Ribbon)",
  STANDARD: "Standard / Regular (1x)",
  SETUP: "Trial Setup / Teardown (2x)"
}

// State
const step = ref(1)
const search = ref('')
const selectedMember = ref(null)
const manualHours = ref('')
const activeSessions = computed(() => logsStore.activeSessions)

const form = reactive({
  category: '',
  sport: ''
})

const sports = ['Agility', 'Barn Hunt', 'Conformation', 'Rally', 'Obedience', 'Freestyle', 'Coursing', 'Other']

// Helpers
const filteredMembers = computed(() => {
  if (!search.value || search.value.length < 2) return []
  const q = search.value.toLowerCase()
  return membersStore.members.filter(m => 
    m.LastName.toLowerCase().includes(q) || m.FirstName.toLowerCase().includes(q)
  ).slice(0, 5)
})

const formatTime = (ts) => {
  if (!ts) return ''
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Wizard Logic
const selectMember = (m) => {
  selectedMember.value = m
  step.value = 2
}

const selectCategory = (cat) => {
  form.category = cat
  if (['SETUP', 'PRACTICE'].includes(cat)) {
    step.value = 3
  } else {
    step.value = 4
  }
}

const selectSport = (s) => {
  form.sport = s
  step.value = 4
}

const getLogData = () => {
  let type = TYPES.STANDARD
  let act = ''
  
  switch(form.category) {
    case 'MAINT': 
      type = TYPES.MAINT
      act = 'Cleaning / Maintenance'
      break
    case 'SETUP': 
      type = TYPES.SETUP
      act = `Trial Setup - ${form.sport}`
      break
    case 'PRACTICE': 
      type = TYPES.STANDARD
      act = `Practices - ${form.sport}`
      break
    case 'ADMIN': 
      type = TYPES.STANDARD
      act = 'Meetings and Admin'
      break
    case 'OTHER': 
      type = TYPES.STANDARD
      act = 'Other Volunteer Work'
      break
  }

  return {
    MemberEmail: selectedMember.value.Email,
    MemberName: `${selectedMember.value.LastName}, ${selectedMember.value.FirstName}`,
    Activity: act,
    type: type,
    Sport: form.sport || '',
    SourceSheet: 'kiosk'
  }
}

// Actions
const doCheckIn = async () => {
  await logsStore.checkIn(getLogData())
  resetWizard()
}

const doManualEntry = async () => {
  const data = getLogData()
  data.Date = new Date()
  
  // Handle Doubling for Manual Entry
  const clock = parseFloat(manualHours.value)
  let credited = clock
  
  if (data.type === TYPES.MAINT || data.type === TYPES.SETUP) {
    credited = clock * 2
  }

  data.clockHours = clock
  data.Hours = credited
  data.Status = 'pending'
  
  await logsStore.addLog(data)
  alert('Hours Submitted for Approval!')
  resetWizard()
}

const confirmSignOut = async (session) => {
  if(confirm(`Sign out ${session.MemberName}?`)) {
    await logsStore.checkOut(session.id, session.Date.seconds)
  }
}

const resetWizard = () => {
  step.value = 1
  search.value = ''
  selectedMember.value = null
  form.category = ''
  form.sport = ''
  manualHours.value = ''
}

onMounted(() => {
  membersStore.initMembers()
  logsStore.initLogs() 
})
</script>

<style scoped>
.kiosk-layout {
  display: flex;
  height: 100vh;
  background: #f1f5f9;
}
.check-in-panel {
  flex: 1;
  padding: 3rem;
  background: white;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
}
.active-panel {
  width: 400px;
  background: #f8fafc;
  padding: 2rem;
  border-left: 1px solid #e2e8f0;
  overflow-y: auto;
}
.kiosk-input {
  width: 100%;
  padding: 1rem;
  font-size: 1.25rem;
  border: 2px solid #cbd5e1;
  border-radius: 0.5rem;
}
.member-btn, .activity-btn {
  width: 100%;
  padding: 1rem;
  text-align: left;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
}
.member-btn:hover, .activity-btn:hover { background: #e0e7ff; border-color: #6366f1; }
.activity-btn.maint { border-left: 5px solid #f97316; }
.activity-btn.setup { border-left: 5px solid #a855f7; }

.action-btn {
  width: 100%;
  padding: 1.5rem;
  border-radius: 0.5rem;
  font-size: 1.25rem;
  font-weight: bold;
  cursor: pointer;
  border: none;
}
.action-btn.primary { background: #4f46e5; color: white; }
.action-btn.secondary { background: #e2e8f0; color: #1e293b; }

.session-card {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.sign-out-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: bold;
  cursor: pointer;
}
</style>