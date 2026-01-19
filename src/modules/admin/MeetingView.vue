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
        <h3 class="text-xs font-bold text-gray-400 uppercase mb-2">Monthly Activity</h3>
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-bold text-gray-800">{{ totalHoursMonth }}</span>
          <span class="text-sm text-gray-500">hours logged</span>
        </div>
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
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Breeds</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-if="membersStore.applicants.length === 0">
              <td colspan="3" class="p-4 text-center text-gray-500 text-sm italic">No pending applicants.</td>
            </tr>
            <tr v-for="member in membersStore.applicants" :key="member.id">
              <td class="px-4 py-3">
                <div class="font-bold text-gray-900">{{ member.LastName }}, {{ member.FirstName }}</div>
                <div class="text-xs text-gray-500">{{ member.Email }}</div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ member.Breeds || 'N/A' }}
              </td>
              <td class="px-4 py-3 text-sm font-mono text-gray-500">
                {{ member.Joined }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="p-4 bg-gray-50 border-b">
          <h3 class="font-bold text-gray-800">📊 Recent Activity</h3>
        </div>
        <div class="p-4">
           <div v-if="loadingLogs" class="text-center py-4 text-gray-500">Loading stats...</div>
           <div v-else class="space-y-4">
             <div v-for="(count, type) in logBreakdown" :key="type" class="flex items-center">
               <div class="w-48 text-sm font-medium text-gray-600 truncate" :title="type">{{ type }}</div>
               <div class="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden mx-2">
                 <div class="h-full bg-indigo-500" :style="{ width: `${(count / totalHoursMonth) * 100}%` }"></div>
               </div>
               <div class="w-12 text-right text-sm font-bold text-gray-900">{{ count }}h</div>
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

onMounted(async () => {
  await membersStore.initMembers()
  loadingLogs.value = true
  await logsStore.initLogs()
  loadingLogs.value = false
})

// Quorum Calculation (20% of voting members)
const quorum = computed(() => {
  return Math.ceil(membersStore.votingMembers.length * 0.2)
})

// Log Stats for Current Month
const currentMonthLogs = computed(() => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return logsStore.logs.filter(l => {
    const d = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date)
    return d >= start
  })
})

const totalHoursMonth = computed(() => {
  return currentMonthLogs.value.reduce((acc, l) => acc + (Number(l.Hours) || 0), 0).toFixed(1)
})

const logBreakdown = computed(() => {
  const breakdown = {}
  currentMonthLogs.value.forEach(l => {
    // Handle blank types by defaulting to Standard
    const type = (l.type && l.type !== '') ? l.type : 'Standard / Regular (1x)'
    breakdown[type] = (breakdown[type] || 0) + (Number(l.Hours) || 0)
  })
  return breakdown
})
</script>