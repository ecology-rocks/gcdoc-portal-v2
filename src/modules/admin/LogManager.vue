<template>
  <div class="space-y-6">
    <div class="flex justify-between items-end border-b pb-2">
      <div>
        <h1 class="text-3xl font-bold text-slate-800">Log Manager</h1>
        <div class="flex space-x-6 mt-4">
          <button 
            @click="activeTab = 'history'"
            class="pb-2 text-sm font-bold border-b-2 transition-colors"
            :class="activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            History & Stats
          </button>
          
          <button 
            @click="activeTab = 'pending'"
            class="pb-2 text-sm font-bold border-b-2 transition-colors relative"
            :class="activeTab === 'pending' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            Pending Approvals
            <span v-if="logsStore.pendingLogs.length" class="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {{ logsStore.pendingLogs.length }}
            </span>
          </button>

          <button 
            @click="activeTab = 'entry'"
            class="pb-2 text-sm font-bold border-b-2 transition-colors"
            :class="activeTab === 'entry' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            Data Entry
          </button>
          
          <button 
            @click="activeTab = 'sheets'"
            class="pb-2 text-sm font-bold border-b-2 transition-colors"
            :class="activeTab === 'sheets' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
          >
            Sign-in Sheets
          </button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'history'" class="h-[calc(100vh-200px)]">
      <LogHistory />
    </div>

    <div v-if="activeTab === 'pending'" class="max-w-4xl mx-auto">
      <div v-if="logsStore.pendingLogs.length === 0" class="text-center py-20 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
        <span class="text-4xl block mb-2">✅</span>
        All caught up! No pending logs.
      </div>

      <div v-else class="space-y-4">
        <div v-for="log in logsStore.pendingLogs" :key="log.id" class="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-400 flex justify-between items-center">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-lg text-gray-800">{{ log.MemberName }}</span>
              <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{{ formatDate(log.Date) }}</span>
            </div>
            <div class="text-sm text-gray-600 mt-1">
              <span class="font-bold">{{ log.Hours }} hrs</span> - {{ log.Activity }}
            </div>
            <div class="text-xs text-gray-400 mt-1">Source: {{ log.SourceSheet }}</div>
          </div>
          
          <div class="flex gap-2">
            <button @click="logsStore.approveLog(log.id)" class="bg-green-100 text-green-700 px-4 py-2 rounded hover:bg-green-200 font-bold text-sm">
              Approve
            </button>
            <button @click="logsStore.rejectLog(log.id)" class="bg-red-50 text-red-600 px-4 py-2 rounded hover:bg-red-100 font-bold text-sm">
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'entry'" class="max-w-2xl mx-auto">
      <div class="bg-white p-6 rounded-lg shadow border border-gray-200">
        <SingleEntryForm />
      </div>
    </div>

    <div v-if="activeTab === 'sheets'">
      <SheetManager />
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import LogHistory from './components/LogHistory.vue'
import SingleEntryForm from './components/SingleEntryForm.vue'
import SheetManager from './components/SheetManager.vue'

const logsStore = useLogsStore()
const activeTab = ref('history')

onMounted(() => {
  logsStore.initLogs()
})

const formatDate = (ts) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString()
}
</script>