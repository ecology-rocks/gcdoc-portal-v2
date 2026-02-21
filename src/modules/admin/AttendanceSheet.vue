<template>
  <div class="attendance-sheet-container">
    <div class="controls no-print">
      <button class="btn-print" @click="printSheet">🖨️ Print Attendance Sheet</button>
      <div v-if="loading" class="loading-msg">Loading member data...</div>
    </div>

    <div class="sheet">
      <div class="sheet-header">
        <h1>GCDOC Membership Meeting Attendance</h1>
        <p class="date">Date Generated: {{ currentDate }}</p>
      </div>

      <table class="attendance-table">
        <thead>
          <tr>
            <th class="col-name">Member Name</th>
            <th class="col-hours">Hours (YTD)</th>
            <th class="col-type">Type</th>
            <th class="col-present">Present</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in sortedMembers" :key="member.id">
            <td class="cell-name">
              {{ member.LastName }}, {{ member.FirstName }}
            </td>
            <td class="cell-hours">
              {{ getMemberHours(member.Email) }}
            </td>
            <td class="cell-type">
              {{ formatMembershipType(member.MembershipType) }}
            </td>
            <td class="cell-present">
              <div class="checkbox-box"></div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="sheet-footer">
        <p>Total Members Listed: {{ sortedMembers.length }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const membersStore = useMembersStore()
const logsStore = useLogsStore()
const loading = ref(false)

const currentDate = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

onMounted(async () => {
  loading.value = true
  await Promise.all([
    membersStore.initMembers(),
    logsStore.initLogs()
  ])
  loading.value = false
})

const sortedMembers = computed(() => {
  // Combine Voting Members (Regular/Lifetime) and Applicants
  const voting = membersStore.votingMembers || []
  const applicants = membersStore.applicants || []
  
  const combined = [...voting, ...applicants]
  
  // Sort by Last Name, then First Name
  return combined.sort((a, b) => {
    const lnA = (a.LastName || '').toLowerCase()
    const lnB = (b.LastName || '').toLowerCase()
    if (lnA < lnB) return -1
    if (lnA > lnB) return 1
    
    const fnA = (a.FirstName || '').toLowerCase()
    const fnB = (b.FirstName || '').toLowerCase()
    if (fnA < fnB) return -1
    if (fnA > fnB) return 1
    
    return 0
  })
})

const getMemberHours = (email) => {
  if (!email) return 0
  const tempHours = logsStore.fiscalYearHours[email] || 0
  return Math.round(tempHours)
}

const formatMembershipType = (type) => {
  if (!type) return ''
  const t = type.toLowerCase()
  if (t === 'lifetime') return 'LT'
  if (t === 'applicant') return '*'
  if (t === 'regular') return '' // Blank for Regular
  if (t === 'family') return ''
  return type // Fallback for edge cases
}

const printSheet = () => {
  window.print()
}
</script>

<style scoped>
.attendance-sheet-container {
  max-width: 850px; /* Standard Letter width approx */
  margin: 0 auto;
  padding: 2rem;
  font-family: "Times New Roman", Times, serif;
  color: #000;
}

/* Controls */
.controls {
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn-print {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: sans-serif;
  font-weight: bold;
}

.btn-print:hover {
  background-color: #2563eb;
}

.loading-msg {
  color: #666;
  font-style: italic;
  font-family: sans-serif;
}

/* Sheet Layout */
.sheet-header {
  text-align: center;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #000;
  padding-bottom: 1rem;
}

.sheet-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  text-transform: uppercase;
}

.date {
  margin: 0;
  font-size: 1rem;
  font-style: italic;
}

/* Table */
.attendance-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12pt;
}

.attendance-table th,
.attendance-table td {
  border: 1px solid #000;
  padding: 0.4rem 0.5rem;
}

.attendance-table th {
  background-color: #f3f3f3; /* Light gray for screen, might be white in print */
  font-weight: bold;
  text-align: left;
}

/* Column Widths */
.col-name { width: 50%; }
.col-hours { width: 15%; text-align: center; }
.col-type { width: 15%; text-align: center; }
.col-present { width: 20%; text-align: center; }

/* Cell Alignment */
.cell-hours, .cell-type { text-align: center; }
.cell-present { padding: 0; vertical-align: middle; }

/* Checkbox visual for print */
.checkbox-box {
  width: 1.2rem;
  height: 1.2rem;
  border: 1px solid #000;
  margin: 0 auto;
}

.sheet-footer {
  margin-top: 1rem;
  font-size: 0.9rem;
  text-align: right;
}

/* PRINT STYLES */
@media print {
  @page {
    margin: 0.5in;
    size: letter;
  }

  .no-print {
    display: none !important;
  }

  .attendance-sheet-container {
    padding: 0;
    margin: 0;
    width: 100%;
    max-width: none;
  }

  .attendance-table th {
    background-color: white !important; /* Save ink */
    border-bottom: 2px solid #000;
  }
  
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>