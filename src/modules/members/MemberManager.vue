<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const store = useMembersStore()
const logsStore = useLogsStore()
const search = ref('')
const selectedType = ref('')
const copiedEmail = ref(null)
const printData = ref(null)
const showReportModal = ref(false)

onMounted(async () => {
    await Promise.all([
        store.initMembers(),
        logsStore.initLogs()
    ])
})

const formatDate = (val) => {
  if (!val) return ''
  const d = val.toDate ? val.toDate() : new Date(val)
  return d.toLocaleDateString()
}

const generateReportData = (member) => {
  const email = member.Email.toLowerCase()
  
  // FY calculations
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const startYear = currentMonth >= 9 ? currentYear : currentYear - 1
  const startDate = new Date(startYear, 9, 1)
  const endDate = new Date(startYear + 1, 9, 1)

  // Filter and sort logs for this specific member in the current FY
  const memberLogs = logsStore.logs.filter(log => {
    if (!log.MemberEmail || log.MemberEmail.toLowerCase() !== email) return false
    const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date)
    return d >= startDate && d < endDate
  }).sort((a, b) => {
    const dateA = a.Date?.toDate ? a.Date.toDate() : new Date(a.Date)
    const dateB = b.Date?.toDate ? b.Date.toDate() : new Date(b.Date)
    return dateA - dateB // Chronological order
  })

  // Pull existing calculations from the store
  const totalHrs = logsStore.fiscalYearHours[email] || 0
  const stdVouchers = logsStore.vouchersByMember[email] || 0
  const blueVouchers = logsStore.blueVouchersByMember[email] || 0

  printData.value = {
    member,
    fyString: `Oct 1, ${startYear} - Sep 30, ${startYear + 1}`,
    logs: memberLogs,
    totalHrs: Math.round(totalHrs * 100) / 100,
    stdVouchers,
    blueVouchers
  }
}

const viewMemberReport = (member) => {
  generateReportData(member)
  showReportModal.value = true
}

const printMemberReport = async (member) => {
  generateReportData(member)
  // Wait for Vue to render the hidden print container
  await nextTick()
  window.print()
}

const closeReportModal = () => {
  showReportModal.value = false
  // Optional: clear data, but harmless to leave it
}

const uniqueTypes = computed(() => {
    const types = store.members.map(m => m.MembershipType).filter(Boolean)
    return [...new Set(types)].sort()
})

/* Replace the filteredMembers computed property */
const filteredMembers = computed(() => {
    let list = store.members
    
    if (selectedType.value) {
        list = list.filter(m => m.MembershipType === selectedType.value)
    }
    
    if (search.value) {
        const q = search.value.toLowerCase()
        list = list.filter(m =>
            m.LastName?.toLowerCase().includes(q) ||
            m.FirstName?.toLowerCase().includes(q) ||
            m.Email?.toLowerCase().includes(q)
        )
    }
    
    return list.sort((a, b) => {
        const nameA = (a.LastName || '').toLowerCase()
        const nameB = (b.LastName || '').toLowerCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
    })
})

const getFYHours = (email) => {
    if (!email) return 0
    const hrs = logsStore.fiscalYearHours[email.toLowerCase()] || 0
    return Math.round(hrs * 100) / 100
}

const copyEmail = async (email) => {
  if (!email) return
  try {
    await navigator.clipboard.writeText(email)
    copiedEmail.value = email
    setTimeout(() => { copiedEmail.value = null }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}
</script>

<template>
    <div class="manager-layout">
        <div class="manager-header">
            <div>
                <h1>Member Directory</h1>
                <p class="subtitle">{{ filteredMembers.length }} active records found</p>
            </div>
            <div class="actions-wrapper">
                <div class="actions">
                    <input 
                      v-model="search" 
                      type="text" 
                      placeholder="Search members..."
                      class="search-input"
                    >
                    <select v-model="selectedType" class="filter-select">
                        <option value="">All Types</option>
                        <option v-for="type in uniqueTypes" :key="type" :value="type">{{ type }}</option>
                    </select>
                    <button @click="$router.push('/members/add')" class="btn-add">
                        <span>+</span> Add Member
                    </button>
                </div>
            </div>
        </div>

        <div class="members-grid">
            <div v-for="m in filteredMembers" :key="m.id" class="member-card">
                <div class="card-header">
                    <div>
                        <div class="primary-text">{{ m.LastName }}, {{ m.FirstName }}</div>
                        <div v-if="m.FirstName2" class="secondary-text">
                          & {{ m.FirstName2 }} {{ m.LastName2 }}
                        </div>
                    </div>
                    <span class="badge badge-blue">{{ m.MembershipType }}</span>
                </div>
                
                <div class="card-body">
                    <button @click="copyEmail(m.Email)" class="btn-copy" :title="'Copy ' + m.Email">
                        <span class="email-text">{{ m.Email }}</span>
                        <span class="copy-icon">{{ copiedEmail === m.Email ? 'Copied!' : '📋' }}</span>
                    </button>
                    <div class="secondary-text">{{ m.Phone1 }}</div>
                    <div class="hours-text">FY Hours: <strong>{{ getFYHours(m.Email) }}</strong></div>
                </div>

                <div class="card-footer">
                    <button @click="viewMemberReport(m)" class="btn-link text-gray">
                        👁️ View Report
                    </button>
                    <button @click="printMemberReport(m)" class="btn-link text-gray">
                        🖨️ Print
                    </button>
                    <button @click="$router.push(`/members/edit/${m.Email}`)" class="btn-link">
                        Edit
                    </button>
                </div>
            </div>
            
            <div v-if="filteredMembers.length === 0" class="empty-state">
                No members found matching your search or filter.
            </div>
        </div>


        <div v-if="printData" class="print-container">
            <div class="print-header">
                <h1>Volunteer Hours Report</h1>
                <h2>{{ printData.member.FirstName }} {{ printData.member.LastName }}</h2>
                <p>Fiscal Year: {{ printData.fyString }}</p>
            </div>

            <div class="print-summary">
                <div class="summary-box">
                    <div class="summary-value">{{ printData.totalHrs }}</div>
                    <div class="summary-label">Total FY Hours</div>
                </div>
                <div class="summary-box">
                    <div class="summary-value">{{ printData.stdVouchers }}</div>
                    <div class="summary-label">Standard Vouchers</div>
                </div>
                <div class="summary-box">
                    <div class="summary-value">{{ printData.blueVouchers }}</div>
                    <div class="summary-label">Blue Vouchers</div>
                </div>
            </div>

            <table class="print-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Activity</th>
                        <th>Type</th>
                        <th class="text-right">Hours</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="log in printData.logs" :key="log.id">
                        <td>{{ formatDate(log.Date) }}</td>
                        <td>{{ log.Activity }}</td>
                        <td>{{ log.type }}</td>
                        <td class="text-right">{{ log.Hours }}</td>
                    </tr>
                    <tr v-if="printData.logs.length === 0">
                        <td colspan="4" class="text-center">No hours logged this fiscal year.</td>
                    </tr>
                </tbody>
            </table>
        </div>


        <div v-if="showReportModal && printData" class="modal-overlay">
          <div class="modal-container">
            <div class="modal-header">
              <h2>Volunteer Hours Report</h2>
              <button @click="closeReportModal" class="close-btn">✕</button>
            </div>
            
            <div class="modal-body">
              <div class="report-header">
                <h3>{{ printData.member.FirstName }} {{ printData.member.LastName }}</h3>
                <p>Fiscal Year: {{ printData.fyString }}</p>
              </div>

              <div class="report-summary">
                <div class="summary-box">
                  <div class="summary-value">{{ printData.totalHrs }}</div>
                  <div class="summary-label">Total FY Hours</div>
                </div>
                <div class="summary-box">
                  <div class="summary-value">{{ printData.stdVouchers }}</div>
                  <div class="summary-label">Standard Vouchers</div>
                </div>
                <div class="summary-box">
                  <div class="summary-value">{{ printData.blueVouchers }}</div>
                  <div class="summary-label">Blue Vouchers</div>
                </div>
              </div>

              <table class="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Activity</th>
                    <th>Type</th>
                    <th class="text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in printData.logs" :key="log.id">
                    <td>{{ formatDate(log.Date) }}</td>
                    <td>{{ log.Activity }}</td>
                    <td>{{ log.type }}</td>
                    <td class="text-right font-bold">{{ log.Hours }}</td>
                  </tr>
                  <tr v-if="printData.logs.length === 0">
                    <td colspan="4" class="empty-state p-4">No hours logged this fiscal year.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="modal-footer">
              <button @click="closeReportModal" class="btn-cancel">Close</button>
              <button @click="printMemberReport(printData.member)" class="btn-primary">
                🖨️ Print Report
              </button>
            </div>
          </div>
        </div>



    </div>
</template>

<style scoped>
.manager-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}
.manager-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .manager-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.actions-wrapper {
  width: 100%;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

@media (min-width: 768px) {
  .actions-wrapper { width: auto; }
  .actions {
    flex-direction: row;
    align-items: center;
  }
}

.filter-select, .search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  width: 100%;
  box-sizing: border-box;
  background-color: white;
}

@media (min-width: 768px) {
  .filter-select, .search-input { width: auto; }
}

.btn-add {
  background-color: #4f46e5;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.btn-add:hover { background-color: #4338ca; }

/* Grid / Card Layout */
.members-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  overflow-y: auto;
  flex: 1;
  padding-bottom: 1rem;
}

@media (min-width: 640px) {
  .members-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .members-grid { grid-template-columns: repeat(3, 1fr); }
}

.member-card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.card-body {
  margin-bottom: 1rem;
  flex: 1;
}

/* --- Updated Card Footer --- */
.card-footer {
  border-top: 1px solid #f3f4f6;
  padding-top: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.text-gray { color: #6b7280; }
.text-gray:hover { color: #374151; }

/* --- Print Container Styles --- */
.print-container {
  display: none; /* Hidden on normal screen views */
}

@media print {
  /* Hide the normal dashboard UI */
  .manager-header, .members-grid, .modal-overlay {
    display: none !important;
  }}
  
  .manager-layout {
    height: auto;
    display: block;
  }
  
  /* Show and style the print container */
  .print-container {
    display: block !important;
    padding: 0;
    color: black;
  }
  
  .print-header { text-align: center; margin-bottom: 2rem; }
  .print-header h1 { font-size: 1.5rem; margin: 0; }
  .print-header h2 { font-size: 1.25rem; margin: 0.25rem 0; color: #374151; }
  
  .print-summary { 
    display: flex; 
    justify-content: space-around; 
    margin-bottom: 2rem; 
    border: 2px solid #cbd5e1; 
    padding: 1rem; 
    border-radius: 0.5rem; 
  }
  
  .summary-box { text-align: center; }
  .summary-value { font-size: 1.5rem; font-weight: bold; color: #111827; }
  .summary-label { font-size: 0.875rem; color: #64748b; text-transform: uppercase; font-weight: bold;}
  
  .print-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .print-table th, .print-table td { border-bottom: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }
  .print-table th { border-bottom: 2px solid #111827; font-weight: bold; color: #111827;}
  
  .text-right { text-align: right !important; }
  .text-center { text-align: center !important; }

.primary-text {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

.secondary-text {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.badge {
  display: inline-flex;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.badge-blue {
  background-color: #dbeafe;
  color: #1e40af;
}

.btn-link {
  background: none;
  border: none;
  color: #4f46e5;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-link:hover {
  color: #312e81;
}

.btn-copy {
  background: none;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: #4f46e5;
  font-size: 0.875rem;
  font-weight: 500;
}
.btn-copy:hover { color: #312e81; }

.copy-icon {
  font-size: 0.75rem;
  background-color: #f3f4f6;
  color: #374151;
  padding: 2px 6px;
  border-radius: 4px;
}

.email-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px; /* Adjust based on your preference */
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-style: italic;
  border: 2px dashed #e5e7eb;
  border-radius: 0.5rem;
}

/* --- View Report Modal Styles --- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
  backdrop-filter: blur(2px);
}

.modal-container {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #111827; }

.close-btn { background: none; border: none; font-size: 1.25rem; color: #9ca3af; cursor: pointer; }

.modal-body { padding: 1.5rem; overflow-y: auto; }

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}

.btn-cancel { background: none; border: none; color: #4b5563; padding: 0.5rem 1rem; cursor: pointer; font-weight: 500; }
.btn-primary { background-color: #4f46e5; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; }

/* Modal Content Details */
.report-header { text-align: center; margin-bottom: 1.5rem; }
.report-header h3 { font-size: 1.5rem; margin: 0 0 0.25rem 0; color: #111827; }
.report-header p { margin: 0; color: #6b7280; }

.report-summary {
  display: flex;
  justify-content: space-around;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.report-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.report-table th, .report-table td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #f1f5f9; text-align: left; }
.report-table th { background: #f8fafc; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }

.font-bold { font-weight: 700; }
.p-4 { padding: 1rem !important; }

</style>