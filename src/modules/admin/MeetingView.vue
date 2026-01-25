<template>
  <div class="max-w-6xl mx-auto space-y-6">
    
    <div class="flex justify-between items-end border-b pb-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Meeting Prep</h1>
        <p class="text-gray-500">Overview for {{ new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }} General Meeting</p>
      </div>
      <div class="text-right">
        <div class="text-3xl font-black text-indigo-600">{{ membersStore.votingMembers.length }}</div>
        <div class="text-xs font-bold text-gray-400 uppercase">Voting Members</div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <div class="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
        <h3 class="text-xs font-bold text-gray-400 uppercase mb-2">Quorum Required (20%)</h3>
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-bold text-gray-800">{{ quorum }}</span>
          <span class="text-sm text-gray-500">members present</span>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
        <h3 class="text-xs font-bold text-gray-400 uppercase mb-2">Pending Applicants</h3>
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-bold text-gray-800">{{ membersStore.applicants.length }}</span>
          <span class="text-sm text-gray-500">to vote in</span>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
        <h3 class="text-xs font-bold text-gray-400 uppercase mb-2">Fiscal Year Activity (YTD)</h3>
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-bold text-gray-800">{{ totalCreditedHoursFY }}</span>
          <span class="text-sm text-gray-500">credited hours</span>
        </div>
        <div class="text-xs text-gray-400 mt-1">Since Oct 1, {{ fyStartYear }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 class="font-bold text-gray-800">📋 Applicant List</h3>
          <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">Pending Vote</span>
        </div>
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FY Hours</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="sortedApplicants.length === 0">
              <td colspan="3" class="p-4 text-center text-gray-500 text-sm italic">No pending applicants.</td>
            </tr>
            <tr v-for="member in sortedApplicants" :key="member.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-3">
                <div class="font-bold text-gray-900">{{ member.LastName }}, {{ member.FirstName }}</div>
              </td>
              <td class="px-4 py-3">
                 <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getApplicantHours(member.Email) >= 10 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'">
                   {{ getApplicantHours(member.Email) }} hrs
                 </span>
              </td>
              <td class="px-4 py-3">
                <button 
                  @click="copyToClipboard(member.Email)"
                  class="group flex items-center space-x-2 text-sm text-indigo-600 hover:text-indigo-900 focus:outline-none"
                  :title="'Copy ' + member.Email"
                >
                  <span class="truncate max-w-[150px]">{{ member.Email }}</span>
                  <span class="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gray-800 text-white px-1 rounded">
                    {{ copiedEmail === member.Email ? 'Copied!' : '📋' }}
                  </span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 class="font-bold text-gray-800">📊 Fiscal Year Breakdown</h3>
          <span class="text-xs text-gray-400 font-mono">Actual Clock Hours</span>
        </div>
        <div class="p-4">
           <div v-if="loadingLogs" class="text-center py-4 text-gray-500">Loading stats...</div>
           <div v-else class="space-y-4">
             <div v-for="(count, type) in logBreakdown" :key="type" class="flex items-center">
               <div class="w-48 text-sm font-medium text-gray-600 truncate" :title="type">{{ type }}</div>
               <div class="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden mx-2">
                 <div class="h-full bg-purple-500" :style="{ width: `${(count / totalActualHoursFY) * 100}%` }"></div>
               </div>
               <div class="w-12 text-right text-sm font-bold text-gray-900">{{ count }}h</div>
             </div>
             <div v-if="totalActualHoursFY == 0" class="text-center text-sm text-gray-400 italic">
               No hours logged this fiscal year yet.
             </div>
           </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const membersStore = useMembersStore()
const logsStore = useLogsStore()
const loadingLogs = ref(false)
const copiedEmail = ref(null)

onMounted(async () => {
  await membersStore.initMembers()
  loadingLogs.value = true
  await logsStore.initLogs()
  loadingLogs.value = false
})

// Quorum
const quorum = computed(() => {
  return Math.ceil(membersStore.votingMembers.length * 0.2)
})

// --- DATE LOGIC ---
const now = new Date()
const currentMonth = now.getMonth()
const currentYear = now.getFullYear()
const fyStartYear = currentMonth >= 9 ? currentYear : currentYear - 1
const fyStartDate = new Date(fyStartYear, 9, 1) // Oct 1

// --- HELPERS ---
const getApplicantHours = (email) => {
  if (!email) return 0
  return logsStore.fiscalYearHours[email] || 0
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedEmail.value = text
    setTimeout(() => { copiedEmail.value = null }, 2000)
  } catch (err) {
    console.error('Failed to copy!', err)
  }
}

const sortedApplicants = computed(() => {
  return [...membersStore.applicants].sort((a, b) => {
    return getApplicantHours(b.Email) - getApplicantHours(a.Email)
  })
})

// --- STATS ---

// 1. Get All Logs for Fiscal Year
const fyLogs = computed(() => {
  return logsStore.logs.filter(l => {
    const d = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date)
    return d >= fyStartDate
  })
})

// 2. Credited Total (For Top Card - uses 'Hours')
const totalCreditedHoursFY = computed(() => {
  return fyLogs.value.reduce((acc, l) => acc + (Number(l.Hours) || 0), 0).toFixed(1)
})

// 3. Breakdown (Uses 'clockHours' OR 'Hours/2' for doubled types)
const logBreakdown = computed(() => {
  const breakdown = {}
  
  fyLogs.value.forEach(l => {
    // Default to 'Standard' if blank
    const type = (l.type && l.type !== '') ? l.type : 'Standard / Regular (1x)'
    
    let val = 0
    
    if (l.clockHours) {
      // Trust the clockHours if they exist
      val = Number(l.clockHours)
    } else {
      // Fallback Logic: Check if it's a "2x" type string
      const isDoubled = type.includes('2x')
      val = Number(l.Hours) || 0
      if (isDoubled) val = val / 2
    }
    
    breakdown[type] = (breakdown[type] || 0) + val
  })
  
  // Format to 1 decimal place
  for (const k in breakdown) {
    breakdown[k] = Number(breakdown[k].toFixed(1))
  }
  
  return breakdown
})

// 4. Total Actual Hours (For Graph Percentage Calculation)
const totalActualHoursFY = computed(() => {
  const values = Object.values(logBreakdown.value)
  return values.reduce((acc, v) => acc + v, 0)
})

</script>