<template>
  <div class="wizard-container">
    <div class="wizard-card">
      <div class="wizard-header">
        <h3>Log Volunteer Hours</h3>
        <p>Recording for: <strong>{{ resolvedFirstName || 'Member' }} {{ resolvedLastName }}</strong></p>
      </div>

      <div v-if="successMessage" class="success-state">{{ successMessage }}</div>

      <div v-if="myActiveSessions.length > 0" class="active-section">
        <h4>Active Session</h4>
        <div v-for="session in myActiveSessions" :key="session.id" class="session-card">
          <div>
            <div class="session-activity">{{ session.Activity }}</div>
            <div class="session-time">Started: {{ formatTime(session.Date) }}</div>
          </div>
          <button @click="confirmSignOut(session)" class="btn-sign-out">Sign Out</button>
        </div>
      </div>

      <div v-if="step === 1" class="step-content">
        <ActivityWizard @complete="handleActivityComplete" />
      </div>

      <div v-if="step === 2" class="step-content">
        <button @click="step = 1" class="back-link">← Back</button>
        <h4 class="sub-header">How do you want to log time?</h4>

        <button @click="doCheckIn" class="action-btn primary" :disabled="submitting">
          {{ submitting ? 'Saving...' : 'Check In Now' }}
        </button>

        <button @click="step = 3" class="action-btn secondary">
          Enter Past Hours
        </button>
      </div>

      <div v-if="step === 3" class="step-content">
        <button @click="step = 2" class="back-link">← Back</button>

        <div class="form-group">
          <label>Hours Worked</label>
          <input
            v-model.number="manualHours"
            type="number"
            step="0.25"
            min="0.25"
            class="input-field"
            placeholder="e.g. 2.5"
          >
        </div>

        <button
          @click="doManualEntry"
          class="action-btn primary"
          :disabled="!manualHours || submitting"
        >
          {{ submitting ? 'Saving...' : 'Submit Hours' }}
        </button>
      </div>
    </div>

    <div v-if="activeSignOut" class="modal-overlay">
      <div class="modal-content">
        <h3 class="sub-header">Sign Out</h3>
        <p class="modal-name"><strong>{{ activeSignOut.MemberName }}</strong></p>

        <div class="time-inputs">
          <div class="form-group">
            <label>Start Time</label>
            <input type="time" v-model="signOutForm.startTime" @change="updateSignOutHours" class="input-field" />
          </div>
          <div class="form-group">
            <label>End Time</label>
            <input type="time" v-model="signOutForm.endTime" @change="updateSignOutHours" class="input-field" />
          </div>
        </div>

        <div class="form-group">
          <label>Total Hours (Rounded to nearest 0.25)</label>
          <input type="number" v-model.number="signOutForm.hours" step="0.25" min="0.25" class="input-field" />
        </div>

        <div class="modal-actions">
          <button @click="submitSignOut" class="action-btn primary">Confirm Sign Out</button>
          <button @click="cancelSignOut" class="action-btn secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useLogsStore } from '@/stores/logsStore'
import ActivityWizard from '@/components/shared/ActivityWizard.vue'

const authStore = useAuthStore()
const logsStore = useLogsStore()

const step = ref(1)
const submitting = ref(false)
const manualHours = ref('')
const successMessage = ref('')

const form = reactive({
  category: '',
  sport: '',
  notes: '',
  activity: '',
  type: ''
})

const activeSignOut = ref(null)
const signOutForm = reactive({
  startTime: '',
  endTime: '',
  hours: 0
})

const resolvedFirstName = computed(() => authStore.profile?.FirstName || '')
const resolvedLastName = computed(() => authStore.profile?.LastName || '')

const myActiveSessions = computed(() => {
  const email = authStore.user?.email?.toLowerCase()
  if (!email) return []
  return logsStore.activeSessions.filter((session) => {
    return session.MemberEmail?.toLowerCase() === email
  })
})

onMounted(async () => {
  await authStore.ensureProfileLoaded()
  if (!logsStore.logs.length) {
    await logsStore.initLogs()
  }
})

const formatTime = (ts) => {
  if (!ts) return ''
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const handleActivityComplete = (data) => {
  form.category = data.category
  form.sport = data.sport
  form.notes = data.notes
  form.activity = data.activity
  form.type = data.type
  step.value = 2
}

const getMemberIdentity = async () => {
  await authStore.ensureProfileLoaded()

  const lookup = await authStore.findMemberByEmail(authStore.user?.email, authStore.user?.uid)
  const firstName = authStore.profile?.FirstName || lookup?.data?.FirstName || ''
  const lastName = authStore.profile?.LastName || lookup?.data?.LastName || ''

  if (!firstName || !lastName) {
    throw new Error('Could not resolve your member profile name yet. Please try again in a moment.')
  }

  return {
    firstName,
    lastName,
    email: authStore.user.email
  }
}

const getLogData = async () => {
  const identity = await getMemberIdentity()
  return {
    MemberEmail: identity.email,
    MemberName: `${identity.lastName}, ${identity.firstName}`,
    Activity: form.activity,
    type: form.type,
    Sport: form.sport || '',
    SourceSheet: 'member-portal'
  }
}

const doCheckIn = async () => {
  submitting.value = true
  try {
    await logsStore.checkIn(await getLogData())
    successMessage.value = 'Checked in successfully.'
    resetWizard()
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

const doManualEntry = async () => {
  submitting.value = true
  try {
    const data = await getLogData()
    const clock = parseFloat(manualHours.value) || 0

    let credited = clock
    if (data.type === logsStore.logType('MAINT') || data.type === logsStore.logType('SETUP')) {
      credited = clock * 2
    }

    await logsStore.addLog({
      ...data,
      Date: new Date(),
      clockHours: clock,
      Hours: credited,
      Status: 'pending'
    })

    successMessage.value = 'Hours submitted for approval.'
    resetWizard()
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}

const formatToTimeInput = (date) => {
  return date.toTimeString().slice(0, 5)
}

const calculateRoundedHours = (startStr, endStr) => {
  if (!startStr || !endStr) return 0
  const [sH, sM] = startStr.split(':').map(Number)
  const [eH, eM] = endStr.split(':').map(Number)

  let diffMins = (eH * 60 + eM) - (sH * 60 + sM)
  if (diffMins < 0) diffMins += 24 * 60

  const hrs = diffMins / 60
  return Math.max(0.25, Math.round(hrs * 4) / 4)
}

const confirmSignOut = (session) => {
  activeSignOut.value = session
  const startD = session.Date.toDate()
  const endD = new Date()

  signOutForm.startTime = formatToTimeInput(startD)
  signOutForm.endTime = formatToTimeInput(endD)
  signOutForm.hours = calculateRoundedHours(signOutForm.startTime, signOutForm.endTime)
}

const updateSignOutHours = () => {
  signOutForm.hours = calculateRoundedHours(signOutForm.startTime, signOutForm.endTime)
}

const submitSignOut = async () => {
  if (!activeSignOut.value) return
  await logsStore.checkOut(activeSignOut.value.id, activeSignOut.value.Date.seconds, signOutForm.hours)
  successMessage.value = 'Signed out successfully.'
  activeSignOut.value = null
}

const cancelSignOut = () => {
  activeSignOut.value = null
}

const resetWizard = () => {
  step.value = 1
  form.category = ''
  form.sport = ''
  form.notes = ''
  form.activity = ''
  form.type = ''
  manualHours.value = ''
}
</script>

<style scoped>
.wizard-container {
  width: 100%;
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
}

.success-state {
  margin-bottom: 1rem;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  border-radius: 0.5rem;
  padding: 0.75rem;
  text-align: center;
  font-weight: 600;
}

.active-section {
  margin-bottom: 1rem;
}

.active-section h4 {
  margin: 0 0 0.5rem;
  color: #374151;
}

.session-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.session-activity {
  font-weight: 600;
  color: #1f2937;
}

.session-time {
  font-size: 0.85rem;
  color: #64748b;
}

.back-link {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  padding: 0;
}

.sub-header {
  margin: 0 0 1rem;
  text-align: center;
  color: #1f2937;
}

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
  box-sizing: border-box;
}

.action-btn {
  width: 100%;
  padding: 0.9rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  margin-top: 0.75rem;
}

.action-btn.primary {
  background: #4f46e5;
  color: white;
}

.action-btn.secondary {
  background: #e2e8f0;
  color: #1e293b;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sign-out {
  background-color: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 0.45rem 0.75rem;
  border-radius: 0.5rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
}

.modal-content {
  width: 100%;
  max-width: 520px;
  background: white;
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.modal-name {
  text-align: center;
  margin: 0 0 0.75rem;
}

.time-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
