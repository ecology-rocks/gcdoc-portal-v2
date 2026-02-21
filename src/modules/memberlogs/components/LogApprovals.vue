<template>
  <div class="approvals-container">
    <div v-if="pendingLogs.length > 0" class="warning-banner">
      <p><strong>Attention:</strong> These logs were submitted via Kiosk and require approval.</p>
    </div>

    <div class="table-wrapper">
      <table class="approvals-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Member</th>
            <th>Activity / Sport</th>
            <th>Type</th>
            <th>Hours</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in pendingLogs" :key="log.id" class="log-row">
            <td class="cell-date">{{ log.Date ? new Date(log.Date.toDate()).toLocaleDateString() : '-' }}</td>
            <td class="cell-member">{{ log.MemberName }}</td>
            <td class="cell-activity">
              <div class="act-name">{{ log.Activity }}</div>
              <div v-if="log.Sport" class="sport-badge">{{ log.Sport }}</div>
            </td>
            <td class="cell-type" :title="log.type">{{ log.type }}</td>
            <td class="cell-hours">{{ log.Hours }}</td>
            <td class="cell-actions">
              <button @click="openEdit(log)" class="btn-icon" title="Edit">✏️</button>
              <button @click="approve(log)" class="btn-approve">Approve</button>
              <button @click="reject(log.id)" class="btn-reject">Reject</button>
            </td>
          </tr>
          <tr v-if="pendingLogs.length === 0">
            <td colspan="6" class="empty-msg">
              <div class="empty-icon">✅</div>
              <div>No pending logs found.</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editingLog" class="modal-overlay">
      <div class="modal-content">
        <h3>Edit Pending Log</h3>
        
        <div class="form-group">
          <label>Activity Description</label>
          <input v-model="editForm.Activity" class="form-input" />
        </div>

        <div class="form-group">
          <label>Sport</label>
          <input v-model="editForm.Sport" class="form-input" placeholder="e.g. Agility" />
        </div>
        
        <div class="form-row">
          <div class="col">
            <label>Credited Hours</label>
            <input v-model.number="editForm.Hours" type="number" step="0.25" class="form-input" />
          </div>
          <div class="col">
            <label>Type</label>
            <select v-model="editForm.type" class="form-input">
              <option :value="TYPES.STANDARD">Standard</option>
              <option :value="TYPES.MAINT">Maintenance</option>
              <option :value="TYPES.SETUP">Trial Setup</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="editingLog = null" class="btn-cancel">Cancel</button>
          <button @click="saveEdit" class="btn-save">Save Changes</button>
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

const TYPES = {
  MAINT: "Cleaning / Maintenance (2x + Blue Ribbon)",
  STANDARD: "Standard / Regular (1x)",
  SETUP: "Trial Setup / Teardown (2x)"
}

const editingLog = ref(null)
const editForm = reactive({ id: '', Activity: '', Hours: 0, type: TYPES.STANDARD, Sport: '' })

const approve = async (log) => await logsStore.updateLog(log.id, { Status: 'approved' })
const reject = async (id) => {
  if(confirm('Are you sure? This will permanently delete the entry.')) await logsStore.deleteLog(id)
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
  await logsStore.updateLog(editForm.id, { ...editForm })
  editingLog.value = null
}
</script>

<style scoped>
.approvals-container { padding: 1rem; overflow-y: auto; height: 100%; font-family: sans-serif; }
.warning-banner { background-color: #fffbeb; border-left: 4px solid #fbbf24; padding: 1rem; margin-bottom: 1rem; }
.warning-banner p { color: #92400e; font-size: 0.875rem; margin: 0; }

.table-wrapper { width: 100%; overflow-x: auto; }
.approvals-table { width: 100%; border-collapse: collapse; text-align: left; }
.approvals-table th { padding: 0.75rem; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 0.875rem; }
.log-row { border-bottom: 1px solid #f3f4f6; }
.log-row:hover { background-color: #f9fafb; }

.cell-date { font-family: monospace; font-size: 0.875rem; padding: 0.75rem; }
.cell-member { font-weight: 700; color: #4f46e5; padding: 0.75rem; }
.cell-activity { padding: 0.75rem; }
.act-name { font-weight: 500; }
.sport-badge { display: inline-block; font-size: 0.75rem; background: #eef2ff; color: #4f46e5; font-weight: 700; padding: 0.125rem 0.25rem; border-radius: 0.25rem; margin-top: 0.25rem; }
.cell-type { font-size: 0.75rem; color: #6b7280; padding: 0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-hours { font-family: monospace; font-weight: 700; padding: 0.75rem; }
.cell-actions { padding: 0.75rem; text-align: right; white-space: nowrap; }

.btn-icon { background: none; border: none; cursor: pointer; padding: 0 0.5rem; font-size: 1rem; }
.btn-approve { background: #22c55e; color: white; border: none; padding: 0.25rem 0.75rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem; margin-right: 0.5rem; }
.btn-reject { background: #ef4444; color: white; border: none; padding: 0.25rem 0.75rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem; }

.empty-msg { text-align: center; padding: 3rem; color: #9ca3af; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; }
.modal-content { background: white; padding: 1.5rem; border-radius: 0.5rem; width: 500px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.form-group { margin-bottom: 0.75rem; }
.form-group label { display: block; font-size: 0.875rem; font-weight: 700; margin-bottom: 0.25rem; }
.form-input { width: 100%; border: 1px solid #d1d5db; padding: 0.5rem; border-radius: 0.375rem; box-sizing: border-box; }
.form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
.col { flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; }
.btn-cancel { background: #e5e7eb; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; }
.btn-save { background: #4f46e5; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; }
</style>