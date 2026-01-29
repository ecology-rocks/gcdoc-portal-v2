<template>
  <div class="approvals-container">
    <div v-if="pendingLogs.length > 0" class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <p class="text-sm text-yellow-700">
        <strong>Attention:</strong> These logs were submitted via Kiosk and require approval.
      </p>
    </div>

    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="text-gray-500 border-b border-gray-200">
          <th class="p-3">Date</th>
          <th class="p-3">Member</th>
          <th class="p-3">Activity / Sport</th>
          <th class="p-3">Type</th>
          <th class="p-3">Hours</th>
          <th class="p-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in pendingLogs" :key="log.id" class="border-b border-gray-100 hover:bg-gray-50">
          <td class="p-3 font-mono text-sm">{{ log.Date ? new Date(log.Date.toDate()).toLocaleDateString() : '-' }}</td>
          <td class="p-3 font-bold text-indigo-600">{{ log.MemberName }}</td>
          <td class="p-3">
            <div class="font-medium">{{ log.Activity }}</div>
            <div v-if="log.Sport" class="text-xs text-indigo-500 font-bold bg-indigo-50 inline-block px-1 rounded mt-1">
              {{ log.Sport }}
            </div>
          </td>
          <td class="p-3 text-xs text-gray-500 max-w-xs truncate" :title="log.type">
            {{ log.type }}
          </td>
          <td class="p-3 font-mono font-bold">{{ log.Hours }}</td>
          <td class="p-3 text-right space-x-2">
            <button @click="openEdit(log)" class="text-gray-500 hover:text-indigo-600 px-2" title="Edit">✏️</button>
            <button @click="approve(log)" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm">Approve</button>
            <button @click="reject(log.id)" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm">Reject</button>
          </td>
        </tr>
        <tr v-if="pendingLogs.length === 0">
          <td colspan="6" class="p-12 text-center text-gray-400">
            <div class="text-4xl mb-2">✅</div>
            <div>No pending logs found.</div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="editingLog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg w-[500px] shadow-xl">
        <h3 class="text-xl font-bold mb-4">Edit Pending Log</h3>
        
        <label class="block text-sm font-bold mb-1">Activity Description</label>
        <input v-model="editForm.Activity" class="input-control w-full mb-3 p-2 border rounded" />

        <label class="block text-sm font-bold mb-1">Sport</label>
        <input v-model="editForm.Sport" class="input-control w-full mb-3 p-2 border rounded" placeholder="e.g. Agility" />
        
        <div class="flex gap-4 mb-4">
          <div class="w-1/2">
            <label class="block text-sm font-bold mb-1">Credited Hours</label>
            <input v-model.number="editForm.Hours" type="number" step="0.25" class="input-control w-full p-2 border rounded" />
          </div>
          <div class="w-1/2">
            <label class="block text-sm font-bold mb-1">Type</label>
            <select v-model="editForm.type" class="input-control w-full p-2 border rounded">
              <option :value="TYPES.STANDARD">Standard</option>
              <option :value="TYPES.MAINT">Maintenance</option>
              <option :value="TYPES.SETUP">Trial Setup</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <button @click="editingLog = null" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
          <button @click="saveEdit" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive } from 'vue'
import { useLogsStore } from '@/stores/logsStore'

const logsStore = useLogsStore()
const pendingLogs = computed(() => logsStore.pendingLogs)

// CONSTANTS (Must match LogHistory exactly)
const TYPES = {
  MAINT: "Cleaning / Maintenance (2x + Blue Ribbon)",
  STANDARD: "Standard / Regular (1x)",
  SETUP: "Trial Setup / Teardown (2x)"
}

// Edit State
const editingLog = ref(null)
const editForm = reactive({
  id: '',
  Activity: '',
  Hours: 0,
  type: TYPES.STANDARD,
  Sport: ''
})

// Actions
const approve = async (log) => {
  await logsStore.updateLog(log.id, { Status: 'approved' })
}

const reject = async (id) => {
  if(confirm('Are you sure? This will permanently delete the entry.')){
    await logsStore.deleteLog(id)
  }
}

const openEdit = (log) => {
  editingLog.value = log
  editForm.id = log.id
  editForm.Activity = log.Activity
  editForm.Hours = log.Hours
  editForm.type = log.type || TYPES.STANDARD
  editForm.Sport = log.Sport || ''
}

const saveEdit = async () => {
  await logsStore.updateLog(editForm.id, {
    Activity: editForm.Activity,
    Hours: editForm.Hours,
    type: editForm.type,
    Sport: editForm.Sport
  })
  editingLog.value = null
}
</script>

<style scoped>
.approvals-container {
  padding: 1rem;
  overflow-y: auto;
  height: 100%;
}
</style>