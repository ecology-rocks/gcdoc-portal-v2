<template>
  <div class="form-wrapper">
    <h2>Record Individual Log</h2>
    <form @submit.prevent="submitSingle">
      <div class="form-group">
        <label>Member Name</label>
        <MemberSelect v-model="form.MemberEmail" />
      </div>

      <div class="form-group">
        <label>Date</label>
        <input v-model="form.Date" type="date" required>
      </div>

      <div class="form-group">
        <label>Activity Description</label>
        <input 
          v-model="form.Activity" 
          type="text" 
          required 
          placeholder="e.g. Mowing field, Agility trial setup"
        >
      </div>

      <div class="form-row">
        <div class="form-group" style="flex: 2">
          <label>Category</label>
          <select v-model="form.type" required>
            <option :value="TYPES.STANDARD">Standard / Regular (1x)</option>
            <option :value="TYPES.SETUP">Trial Setup / Teardown (2x)</option>
            <option :value="TYPES.MAINT">Cleaning / Maintenance (2x)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Clock Hours</label>
          <input 
            v-model.number="form.clockHours" 
            type="number" 
            step="0.25" 
            min="0"
            required
            placeholder="Actual time"
          >
        </div>
      </div>

      <div class="calc-preview" :class="{ 'highlight': isDoubleTime }">
        <div class="calc-row">
          <span>Rate:</span>
          <strong>{{ isDoubleTime ? '2x Double Time' : '1x Standard' }}</strong>
        </div>
        <div class="calc-row">
          <span>Credited Hours:</span>
          <span class="credit-value">{{ calculatedCredit }}</span>
        </div>
        <div v-if="isMaintenance" class="calc-note">
          ✓ Maintenance Flag Set
        </div>
      </div>

      <button type="submit" class="submit-btn">Save Entry</button>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLogsStore } from '@/stores/logsStore'
import { useMembersStore } from '@/stores/membersStore' // Ensure member store is available if needed for lookup
import MemberSelect from '@/components/admin/MemberSelect.vue'

const logsStore = useLogsStore()
const memberStore = useMembersStore()

// --- CONSTANTS ---
const TYPES = {
  STANDARD: logsStore.logType('STANDARD'),
  SETUP: logsStore.logType('SETUP'),
  MAINT: logsStore.logType('MAINT')
}

// --- STATE ---
const form = ref({
  MemberEmail: '',
  MemberName: '', // Will populate on submit
  Date: new Date().toISOString().split('T')[0],
  Activity: '',
  clockHours: 0,
  type: TYPES.STANDARD
})

// --- COMPUTED HELPERS ---
const isDoubleTime = computed(() => {
  return form.value.type === TYPES.SETUP || form.value.type === TYPES.MAINT
})

const isMaintenance = computed(() => {
  return form.value.type === TYPES.MAINT
})

const calculatedCredit = computed(() => {
  const base = parseFloat(form.value.clockHours) || 0
  return isDoubleTime.value ? base * 2 : base
})

// --- SUBMIT ---
const submitSingle = async () => {
  if (!form.value.MemberEmail) return alert('Please select a member first.')
  if (form.value.clockHours <= 0) return alert('Please enter valid hours.')

  // Look up Member Name for redundancy (optional but good for your CSV structure)
  const member = memberStore.getMemberByEmail(form.value.MemberEmail)
  const memberName = member ? `${member.LastName}, ${member.FirstName}` : ''

  const payload = {
    MemberEmail: form.value.MemberEmail,
    MemberName: memberName,
    Date: form.value.Date,
    Activity: form.value.Activity,
    type: form.value.type,
    
    // Time Calculations
    clockHours: parseFloat(form.value.clockHours),
    Hours: calculatedCredit.value, // The multiplied value
    
    // Flags
    isMaintenance: isMaintenance.value,
    Status: 'approved',
    FiscalYearRollover: 'No',
    SourceSheet: ''
  }

  await logsStore.addLog(payload)
  
  alert(`Saved! Credited ${payload.Hours} hours.`)
  
  // Reset Form
  form.value.Activity = ''
  form.value.clockHours = 0
  form.value.MemberEmail = ''
  form.value.type = TYPES.STANDARD
}
</script>

<style scoped>
.form-wrapper {
  max-width: 500px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

h2 {
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  color: #111827;
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 1rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.375rem;
}

input, select {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: #fff;
  transition: border-color 0.15s;
}

input:focus, select:focus {
  border-color: #6366f1;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* Calculation Preview Box */
.calc-preview {
  background-color: #f9fafb;
  border: 1px dashed #d1d5db;
  padding: 1rem;
  border-radius: 0.375rem;
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
}

.calc-preview.highlight {
  background-color: #f0fdf4;
  border-color: #86efac;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  color: #4b5563;
}

.credit-value {
  font-weight: 800;
  font-size: 1.1rem;
  color: #111827;
}

.calc-preview.highlight .credit-value {
  color: #15803d;
}

.calc-note {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #15803d;
  font-weight: bold;
  text-align: right;
}

.submit-btn {
  width: 100%;
  background-color: #4f46e5;
  color: white;
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover {
  background-color: #4338ca;
}
</style>