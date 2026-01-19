<template>
  <div class="max-w-5xl mx-auto">
    <div class="flex justify-between items-end mb-6 print:hidden">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Meeting Attendance</h1>
        <p class="text-gray-500 text-sm mt-1">
          Fiscal Year: {{ fiscalYearStart.toLocaleDateString() }} - {{ fiscalYearEnd.toLocaleDateString() }}
        </p>
      </div>
      <div class="flex space-x-3">
        <button @click="activeTab = 'applicants'" 
          :class="activeTab === 'applicants' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'"
          class="px-4 py-2 rounded-md font-medium text-sm transition shadow-sm">
          Applicants
        </button>
        <button @click="activeTab = 'signin'" 
          :class="activeTab === 'signin' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'"
          class="px-4 py-2 rounded-md font-medium text-sm transition shadow-sm">
          Sign-In Sheet
        </button>
        <button @click="print" class="bg-gray-800 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 flex items-center">
          🖨️ Print PDF
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'applicants'" class="bg-white shadow rounded-lg overflow-hidden print:hidden">
      <div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <h3 class="font-semibold text-gray-800">Applicant Voting Eligibility</h3>
        <span class="text-xs font-mono text-gray-500">Threshold: 10 Hours</span>
      </div>
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="m in sortedApplicants" :key="m.id" class="hover:bg-gray-50 transition" :class="getHours(m.Email) >= 10 ? 'bg-green-50/50' : ''">
            <td class="px-6 py-4 text-sm font-medium text-gray-900">
              {{ formatName(m) }}
              <div v-if="m.Breeds" class="text-xs text-gray-400 font-normal mt-0.5">{{ m.Breeds }}</div>
            </td>
            
            <td class="px-6 py-4 text-sm text-gray-500">
              <div 
                @click="copyEmail(m.Email)" 
                class="flex items-center space-x-2 cursor-pointer group w-fit"
                title="Click to copy"
              >
                <span class="group-hover:text-indigo-600 transition-colors">{{ m.Email }}</span>
                
                <span v-if="lastCopied === m.Email" class="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Copied!</span>
                <span v-else class="opacity-0 group-hover:opacity-100 text-gray-400 text-xs">📋</span>
              </div>
            </td>

            <td class="px-6 py-4 text-sm text-gray-500 font-mono">
              <span :class="getHours(m.Email) >= 10 ? 'text-green-700 font-bold' : ''">
                {{ getHours(m.Email) }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span v-if="getHours(m.Email) >= 10" class="px-2 py-1 text-xs font-bold bg-green-100 text-green-800 rounded-full">Eligible</span>
              <span v-else class="px-2 py-1 text-xs font-bold bg-yellow-100 text-yellow-800 rounded-full">Pending</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="bg-white shadow rounded-lg p-8 print:p-0 print:shadow-none">
      
      <div id="print-area">
        
        <div class="mb-6 border-b-2 border-black pb-4">
          <div class="flex justify-between items-end">
            <h1 class="text-2xl font-bold uppercase tracking-wide">Membership Meeting Attendance</h1>
            <span class="text-sm text-gray-600">Generated: {{ new Date().toLocaleDateString() }}</span>
          </div>
        </div>

        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b-2 border-black">
              <th class="py-2 w-12 font-bold text-sm uppercase">LT</th>
              <th class="py-2 font-bold text-sm uppercase">Member Name</th>
              <th class="py-2 w-32 font-bold text-sm uppercase">Type</th>
              <th class="py-2 w-32 font-bold text-sm uppercase text-center">
                Hours To Date<br>
                <span class="text-xs font-normal">(10/1 to 9/30)</span>
              </th>
              <th class="py-2 w-20 font-bold text-sm uppercase text-center">Present</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in activeMembers" :key="m.id" class="border-b border-gray-300">
              <td class="py-3 text-center font-bold">
                <span v-if="m.MembershipType === 'Lifetime'">LT</span>
              </td>
              
              <td class="py-3 font-semibold text-lg">
                {{ formatName(m) }}
              </td>
              
              <td class="py-3 text-sm">
                {{ m.MembershipType }}
              </td>
              
              <td class="py-3 text-center font-mono text-base">
                {{ getHours(m.Email) }}
              </td>
              
              <td class="py-3 text-center">
                <div class="inline-block w-6 h-6 border-2 border-black rounded-sm"></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const membersStore = useMembersStore()
const logsStore = useLogsStore()
const activeTab = ref('applicants')
const lastCopied = ref(null)

// Fiscal Year Logic (Oct 1 - Sept 30)
const fiscalYearStart = new Date('2025-10-01')
const fiscalYearEnd = new Date('2026-09-30')

onMounted(() => {
  membersStore.initMembers()
  logsStore.initLogs()
})

// 1. Helper Function (Defined first so computed props can use it)
const getHours = (email) => {
  if (!email) return 0
  
  // Filter logs for this specific member AND the fiscal year
  const memberLogs = logsStore.logs.filter(log => {
    if (log.MemberEmail?.toLowerCase() !== email.toLowerCase()) return false
    
    if (!log.Date) return false
    const logDate = log.Date.toDate ? log.Date.toDate() : new Date(log.Date)
    return logDate >= fiscalYearStart
  })

  // Sum hours
  const total = memberLogs.reduce((sum, log) => sum + (Number(log.Hours) || 0), 0)
  return total % 1 === 0 ? total : total.toFixed(2)
}

// 2. Computed Sort for Applicants (Eligible First)
const sortedApplicants = computed(() => {
  // Create a shallow copy of the array from the store
  const list = [...membersStore.applicants]

  return list.sort((a, b) => {
    const hoursA = parseFloat(getHours(a.Email))
    const hoursB = parseFloat(getHours(b.Email))
    
    const isEligibleA = hoursA >= 10
    const isEligibleB = hoursB >= 10

    // Priority 1: Eligibility (True comes before False)
    if (isEligibleA && !isEligibleB) return -1
    if (!isEligibleA && isEligibleB) return 1
    
    // Priority 2: Last Name (Alphabetical)
    return a.LastName.localeCompare(b.LastName)
  })
})

const activeMembers = computed(() => {
    return membersStore.members
      .filter(m => m.MembershipType !== 'Applicant' && m.MembershipType !== 'Inactive')
      .sort((a, b) => a.LastName.localeCompare(b.LastName))
})

const formatName = (m) => {
  let name = `${m.LastName}, ${m.FirstName}`
  if (m.FirstName2) {
    name += ` & ${m.FirstName2}`
  }
  return name
}

const copyEmail = async (email) => {
  if(!email) return
  try {
    await navigator.clipboard.writeText(email)
    lastCopied.value = email
    setTimeout(() => lastCopied.value = null, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

const print = () => window.print()
</script>