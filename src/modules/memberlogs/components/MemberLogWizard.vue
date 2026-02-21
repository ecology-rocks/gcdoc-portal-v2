<template>
  <div class="wizard-container">
    <div v-if="success" class="success-state">
      <div class="icon">✅</div>
      <h2>Hours Logged!</h2>
      <p>Thanks for your help, {{ authStore.profile?.FirstName }}!</p>
      <button @click="resetWizard" class="btn-reset">Log More Hours</button>
    </div>

    <div v-else class="wizard-card">
      <div class="wizard-header">
        <h3>Log Volunteer Hours</h3>
        <p>Recording for: <strong>{{ authStore.profile?.FirstName }} {{ authStore.profile?.LastName }}</strong></p>
      </div>

      <div v-if="step === 1" class="step-content">
        <label class="step-label">What did you do?</label>
        <div class="button-grid">
          <button @click="selectCategory('MAINT')" class="grid-btn border-orange">🧹 Cleaning / Maintenance</button>
          <button @click="selectCategory('SETUP')" class="grid-btn border-purple">🏗️ Trial Setup / Teardown</button>
          <button @click="selectCategory('PRACTICE')" class="grid-btn">🐕 Practices / Runthroughs</button>
          <button @click="selectCategory('ADMIN')" class="grid-btn">📝 Admin / Meetings</button>
          <button @click="selectCategory('OTHER')" class="grid-btn">❓ Other</button>
        </div>
      </div>

      <div v-if="step === 2" class="step-content">
        <button @click="step = 1" class="back-link">← Back</button>
        <label class="step-label">Which Sport?</label>
        <div class="button-grid two-col">
          <button v-for="s in sports" :key="s" @click="selectSport(s)" class="grid-btn">
            {{ s }}
          </button>
        </div>
      </div>

      <div v-if="step === 3" class="step-content">
        <button @click="step = (needsSport ? 2 : 1)" class="back-link">← Back</button>
        
        <div class="form-group">
          <label>Date</label>
          <input v-model="form.date" type="date" class="input-field">
        </div>

        <div class="form-group">
          <label>Hours Worked</label>
          <input 
            v-model.number="form.hours" 
            type="number" 
            step="0.25" 
            class="input-field hours-input" 
            placeholder="0.00"
            autofocus
          >
        </div>

        <div class="form-group">
          <label>Notes (Optional)</label>
          <textarea v-model="form.notes" class="input-field" rows="2" placeholder="Details..."></textarea>
        </div>

        <button 
          @click="submitLog" 
          class="action-btn primary" 
          :disabled="!form.hours || submitting"
        >
          {{ submitting ? 'Saving...' : 'Submit Hours' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useLogsStore } from '@/stores/logsStore'

const authStore = useAuthStore()
const logsStore = useLogsStore()

const step = ref(1)
const submitting = ref(false)
const success = ref(false)

const sports = ['Agility', 'Barn Hunt', 'Conformation', 'Rally', 'Obedience', 'Freestyle', 'Coursing', 'Other']

const form = reactive({
  category: '',
  sport: '',
  date: new Date().toISOString().split('T')[0],
  hours: '',
  notes: ''
})

const needsSport = computed(() => {
  return ['SETUP', 'PRACTICE'].includes(form.category)
})

const selectCategory = (cat) => {
  form.category = cat
  if (needsSport.value) {
    step.value = 2
  } else {
    step.value = 3
  }
}

const selectSport = (s) => {
  form.sport = s
  step.value = 3
}

const submitLog = async () => {
  submitting.value = true
  
  const clock = parseFloat(form.hours) || 0
  let credit = clock
  // Use the store helper to fetch the correct string for the category
  const typeString = logsStore.logType(form.category)
  let act = form.notes || ''

  // Apply multiplier logic based on the category
  if (form.category === 'MAINT') {
    act = act || 'Cleaning / Maintenance'
    credit = clock * 2
  } else if (form.category === 'SETUP') {
    act = act || `Trial Setup - ${form.sport}`
    credit = clock * 2
  } else {
    if (form.category === 'PRACTICE') act = `Practices - ${form.sport} ${act}`
    if (form.category === 'ADMIN') act = `Meetings and Admin ${act}`
  }

  const payload = {
    MemberEmail: authStore.user.email,
    MemberName: `${authStore.profile.LastName}, ${authStore.profile.FirstName}`,
    Date: new Date(form.date),
    clockHours: clock,
    Hours: credit,
    Activity: act,
    type: typeString,
    Sport: form.sport,
    Status: 'pending',
    SourceSheet: 'member-portal'
  }

  try {
    await logsStore.addLog(payload)
    success.value = true
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

const resetWizard = () => {
  step.value = 1
  form.category = ''
  form.sport = ''
  form.hours = ''
  form.notes = ''
  success.value = false
}
</script>

<style scoped>
.wizard-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.wizard-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  border: 1px solid #e5e7eb;
}

.wizard-header {
  text-align: center;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 1rem;
}

.wizard-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.wizard-header p {
  margin: 0.25rem 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

/* Steps */
.step-label {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
  color: #374151;
}

/* Buttons */
.button-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.button-grid.two-col {
  grid-template-columns: 1fr 1fr;
}

.grid-btn {
  padding: 1rem;
  text-align: left;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.grid-btn:hover {
  background: #eff6ff;
  border-color: #6366f1;
  transform: translateY(-1px);
}

.border-orange { border-left: 4px solid #f97316; }
.border-purple { border-left: 4px solid #a855f7; }

.back-link {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  padding: 0;
}
.back-link:hover { text-decoration: underline; }

/* Form inputs */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
}

.input-field {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
}

.hours-input {
  font-size: 1.5rem;
  text-align: center;
  font-weight: 700;
  color: #4f46e5;
}

.action-btn {
  width: 100%;
  padding: 1rem;
  border-radius: 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  margin-top: 1rem;
  background-color: #4f46e5;
  color: white;
}
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Success State */
.success-state {
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}

.icon { font-size: 3rem; margin-bottom: 1rem; }

.btn-reset {
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: none;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  color: #374151;
}
.btn-reset:hover { border-color: #9ca3af; }
</style>