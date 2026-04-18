<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'vue-router'
import ActivityWizard from '@/components/shared/ActivityWizard.vue'

const membersStore = useMembersStore()
const logsStore = useLogsStore()
const authStore = useAuthStore()
const router = useRouter()

const TYPES = {
  MAINT: "Cleaning / Maintenance (2x + Blue Ribbon)",
  STANDARD: "Standard / Regular (1x)",
  SETUP: "Trial Setup / Teardown (2x)"
}

const step = ref(1)
const search = ref('')
const selectedMember = ref(null)
const manualHours = ref('')
const activeSessions = computed(() => logsStore.activeSessions)

const form = reactive({ 
  category: '', 
  sport: '',
  notes: '',
  activity: '',
  type: ''
})


const filteredMembers = computed(() => {
  let list = membersStore.members
  
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(m => 
      m.LastName?.toLowerCase().includes(q) || 
      m.FirstName?.toLowerCase().includes(q) ||
      m.LastName2?.toLowerCase().includes(q) || 
      m.FirstName2?.toLowerCase().includes(q)
    )
  }
  
  // Sort alphabetically by primary Last Name, then First Name
  return list.sort((a, b) => {
    const nameA = `${a.LastName || ''}${a.FirstName || ''}`.toLowerCase()
    const nameB = `${b.LastName || ''}${b.FirstName || ''}`.toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

const formatTime = (ts) => {
  if (!ts) return ''
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const selectMember = (m) => { selectedMember.value = m; step.value = 2 }

const handleActivityComplete = (data) => {
  form.category = data.category
  form.sport = data.sport
  form.notes = data.notes
  form.activity = data.activity
  form.type = data.type
  
  step.value = 4
}

const getLogData = () => {
  return {
    MemberEmail: selectedMember.value.Email,
    MemberName: `${selectedMember.value.LastName}, ${selectedMember.value.FirstName}`,
    Activity: form.activity, // Pre-formatted by the Wizard
    type: form.type,         // Pre-formatted by the Wizard
    Sport: form.sport || '',
    SourceSheet: 'kiosk'
  }
}

const doCheckIn = async () => {
  await logsStore.checkIn(getLogData())
  resetWizard()
}

const doManualEntry = async () => {
  const data = getLogData()
  data.Date = new Date()
  
  const clock = parseFloat(manualHours.value) || 0
  let credited = clock

  // Compare against store strings to apply the multiplier
  if (data.type === logsStore.logType('MAINT') || data.type === logsStore.logType('SETUP')) {
    credited = clock * 2
  }

  data.clockHours = clock
  data.Hours = credited
  data.Status = 'pending'
  
  await logsStore.addLog(data)
  alert('Hours Submitted for Approval!')
  resetWizard()
}

const activeSignOut = ref(null)
const signOutForm = reactive({
  startTime: '',
  endTime: '',
  hours: 0
})

const formatToTimeInput = (date) => {
  return date.toTimeString().slice(0, 5) // HH:MM
}

const calculateRoundedHours = (startStr, endStr) => {
  if (!startStr || !endStr) return 0
  const [sH, sM] = startStr.split(':').map(Number)
  const [eH, eM] = endStr.split(':').map(Number)
  
  let diffMins = (eH * 60 + eM) - (sH * 60 + sM)
  if (diffMins < 0) diffMins += 24 * 60 // Handle midnight crossover
  
  let hrs = diffMins / 60
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
  const session = activeSignOut.value
  await logsStore.checkOut(session.id, session.Date.seconds, signOutForm.hours)
  activeSignOut.value = null
}

const cancelSignOut = () => {
  activeSignOut.value = null
}

const handleFooterAuthAction = async () => {
  if (authStore.user) {
    await authStore.logout()
    router.push('/kiosk')
    return
  }

  router.push('/login')
}

const resetWizard = () => {
  step.value = 1; search.value = ''; selectedMember.value = null; form.category = ''; form.sport = ''; manualHours.value = ''
}

onMounted(() => { membersStore.initMembers(); logsStore.initLogs() })
</script>

<template>
  <div class="kiosk-wrapper">
    
    <div class="wizard-card">
      <header class="kiosk-header">
        <h1>Volunteer Check-In</h1>
        <p>Gem City Dog Obedience Club</p>
      </header>

      <div v-if="step === 1" class="step-content">
        <label class="step-label">Who are you?</label>
        <input 
          v-model="search" 
          placeholder="Search by name..." 
          class="kiosk-input"
          autofocus
        />
        
        <div class="table-container kiosk-table">
          <table>
            <thead>
              <tr>
                <th>Primary Member</th>
                <th>Secondary Member</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="m in filteredMembers" 
                :key="m.id" 
                @click="selectMember(m)"
                class="clickable-row"
              >
                <td>
                  <span class="font-bold">{{ m.LastName }}</span>, {{ m.FirstName }}
                </td>
                <td>
                  <span v-if="m.FirstName2 || m.LastName2">
                    <span class="font-bold">{{ m.LastName2 || m.LastName }}</span>, {{ m.FirstName2 }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
              </tr>
              <tr v-if="filteredMembers.length === 0">
                <td colspan="2" class="empty-state">No members found matching that name.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="step === 2" class="step-content">
        <ActivityWizard @complete="handleActivityComplete" />
      </div>

      <div v-if="step === 4" class="step-content">
        <button @click="step = 2" class="back-link">← Back</button>
        <h3 class="sub-header">How do you want to log time?</h3>
        
        <button @click="doCheckIn" class="action-btn primary">
          ⏱️ Check In Now
          <span class="subtext">I am starting my shift</span>
        </button>

        <button @click="step = 5" class="action-btn secondary">
          📝 Enter Past Hours
          <span class="subtext">I already finished the work</span>
        </button>
      </div>

      <div v-if="step === 5" class="step-content">
        <label class="step-label">Enter Actual Hours Worked</label>
        <input v-model.number="manualHours" type="number" step="0.25" class="kiosk-input mb-4" placeholder="e.g. 2.5" />
        <button @click="doManualEntry" class="action-btn primary" :disabled="!manualHours">Submit Log</button>
        <button @click="step = 4" class="cancel-btn">Cancel</button>
      </div>
    </div>

    <div class="active-section">
      <h2 class="section-title">
        Active Volunteers <span class="count-badge">{{ activeSessions.length }}</span>
      </h2>
      
      <div v-if="activeSessions.length === 0" class="empty-state">
        No one is currently checked in.
      </div>

      <div class="active-grid">
        <div v-for="session in activeSessions" :key="session.id" class="session-card">
          <div class="card-info">
            <div class="card-name">{{ session.MemberName }}</div>
            <div class="card-meta">
              {{ session.Activity }} 
              <span v-if="session.Sport" class="sport-tag">{{ session.Sport }}</span>
            </div>
            <div class="card-time">Started: {{ formatTime(session.Date) }}</div>
          </div>
          <button @click="confirmSignOut(session)" class="btn-sign-out">
            Sign Out
          </button>
        </div>
      </div>
    </div>

<div v-if="activeSignOut" class="modal-overlay">
      <div class="modal-content">
        <h3 class="sub-header mb-2">Sign Out</h3>
        <p class="text-center mb-4 text-indigo-900 text-lg"><strong>{{ activeSignOut.MemberName }}</strong></p>
        
        <div class="time-inputs">
          <div class="input-group">
            <label>Start Time</label>
            <input type="time" v-model="signOutForm.startTime" @change="updateSignOutHours" class="kiosk-input" />
          </div>
          <div class="input-group">
            <label>End Time</label>
            <input type="time" v-model="signOutForm.endTime" @change="updateSignOutHours" class="kiosk-input" />
          </div>
        </div>

        <div class="input-group mt-2">
          <label>Total Hours (Rounded to nearest 0.25)</label>
          <input type="number" v-model.number="signOutForm.hours" step="0.25" min="0.25" class="kiosk-input font-bold text-indigo-700 bg-indigo-50" />
        </div>

        <div class="modal-actions mt-4">
          <button @click="submitSignOut" class="action-btn primary mt-0">Confirm Sign Out</button>
          <button @click="cancelSignOut" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>

    <div class="kiosk-footer">
      <button
        v-if="authStore.user"
        class="admin-link admin-link-btn"
        @click="handleFooterAuthAction"
      >
        Logout
      </button>
      <RouterLink v-else to="/login" class="admin-link">
        Member Login
      </RouterLink>
    </div>

  </div>
</template>

<style scoped>
.kiosk-wrapper {
  min-height: 100vh;
  background-color: #f1f5f9;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* --- Wizard Card --- */
.wizard-card {
  background: white;
  width: 100%;
  max-width: 600px;
  border-radius: 1rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  padding: 2rem;
  margin-bottom: 3rem;
  border: 1px solid #e2e8f0;
}

.kiosk-header {
  text-align: center;
  margin-bottom: 2rem;
}

.kiosk-header h1 {
  font-size: 2rem;
  font-weight: 800;
  color: #312e81;
  margin: 0;
  line-height: 1.2;
}

.kiosk-header p {
  color: #64748b;
  margin: 0.5rem 0 0 0;
  font-weight: 500;
}

/* Steps */
.step-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.step-label {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #1f2937;
  text-align: center;
}

/* Inputs & Lists */
.kiosk-input {
  width: 100%;
  padding: 1rem;
  font-size: 1.25rem;
  border: 2px solid #cbd5e1;
  border-radius: 0.75rem;
  box-sizing: border-box;
  text-align: center;
  margin-bottom: 1rem;
}

.kiosk-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
}

.list-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list-btn {
  width: 100%;
  padding: 1rem;
  text-align: left;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.list-btn:hover {
  background: #eff6ff;
  border-color: #6366f1;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Category Grid */
.button-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.grid-btn {
  padding: 1.25rem;
  text-align: left;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.grid-btn:hover {
  background: #eff6ff;
  border-color: #6366f1;
}

.border-orange { border-left: 6px solid #f97316; }
.border-purple { border-left: 6px solid #a855f7; }

.greeting {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  text-align: center;
  color: #334155;
}

.reset-link, .back-link {
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  color: #64748b;
  font-size: 0.9rem;
}

.reset-link { color: #ef4444; margin-left: 0.5rem; }
.back-link { display: block; margin-bottom: 1rem; font-weight: 600; }

/* Action Buttons */
.sub-header {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  text-align: center;
}

.action-btn {
  width: 100%;
  padding: 1.5rem;
  border-radius: 0.75rem;
  font-size: 1.25rem;
  font-weight: 800;
  cursor: pointer;
  border: none;
  margin-bottom: 1rem;
  text-align: center;
  transition: transform 0.1s;
}

.action-btn:active { transform: scale(0.98); }
.action-btn.primary { background: #4f46e5; color: white; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3); }
.action-btn.secondary { background: #e2e8f0; color: #1e293b; }
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.subtext {
  display: block;
  font-size: 0.875rem;
  font-weight: normal;
  opacity: 0.8;
  margin-top: 0.25rem;
}

.cancel-btn {
  background: none;
  border: none;
  width: 100%;
  color: #64748b;
  cursor: pointer;
  padding: 1rem;
  font-weight: 600;
}

/* --- Active Volunteers Section --- */
.active-section {
  width: 100%;
  max-width: 800px;
}

.section-title {
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.count-badge {
  background-color: #334155;
  color: white;
  font-size: 0.875rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  vertical-align: middle;
}

.active-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.session-card {
  background: white;
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.card-info { flex: 1; }

.card-name {
  font-weight: 700;
  font-size: 1.125rem;
  color: #312e81;
  margin-bottom: 0.25rem;
}

.card-meta {
  font-size: 0.9rem;
  color: #475569;
}

.sport-tag {
  display: inline-block;
  background-color: #f1f5f9;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 0.5rem;
  font-weight: 600;
  color: #64748b;
  vertical-align: middle;
}

.card-time {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 0.25rem;
}

.btn-sign-out {
  background-color: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  margin-left: 1rem;
}

.btn-sign-out:hover {
  background-color: #fecaca;
  color: #b91c1c;
}

.empty-state {
  text-align: center;
  color: #94a3b8;
  font-style: italic;
  padding: 2rem;
  background: rgba(255,255,255,0.5);
  border-radius: 0.5rem;
}

.font-bold { font-weight: 700; }
.mb-4 { margin-bottom: 1rem; }

/* Responsive Adjustments */
@media (min-width: 640px) {
  .button-grid.two-col {
    grid-template-columns: 1fr 1fr;
  }
  
  .active-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.kiosk-footer {
  position: fixed;
  bottom: 1.5rem;
  left: 0;
  width: 100%;
  text-align: center;
  z-index: 10;
}

.admin-link {
  color: #64748b; /* Slate-500: Subtle and low contrast */
  font-size: 0.875rem;
  text-decoration: none;
  font-weight: 500;
  opacity: 0.6;
  transition: all 0.2s;
  padding: 0.5rem 1rem;
}

.admin-link-btn {
  background: none;
  border: none;
  cursor: pointer;
}

.admin-link:hover {
  color: #cbd5e1; /* Slate-300: Lighter on hover */
  opacity: 1;
  text-decoration: underline;
}

/* --- Kiosk Table --- */
.kiosk-table {
  max-height: 350px;
  overflow-y: auto;
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
  background: white;
}

.kiosk-table table {
  width: 100%;
  border-collapse: collapse;
}

.kiosk-table th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  z-index: 1;
}

.kiosk-table td {
  padding: 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1f2937;
  font-size: 1.1rem;
}

.clickable-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.clickable-row:hover {
  background-color: #eff6ff;
}

.text-muted {
  color: #94a3b8;
}

/* --- Sign Out Modal --- */
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
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.time-inputs {
  display: flex;
  gap: 1rem;
}

.input-group {
  flex: 1;
}

.input-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.5rem;
  text-align: left;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mt-0 { margin-top: 0 !important; }
.mt-2 { margin-top: 0.5rem; }
.mt-4 { margin-top: 1rem; }
.mb-2 { margin-bottom: 0.5rem; }
.text-center { text-align: center; }
.text-lg { font-size: 1.125rem; }
.text-indigo-900 { color: #312e81; }
.text-indigo-700 { color: #4338ca; }
.bg-indigo-50 { background-color: #eef2ff; }
</style>