<template>
  <div class="wp-sync-container">
    <div class="page-header">
      <h1>WordPress Sync</h1>
      <p>Update website member hours and reconcile accounts.</p>
    </div>

    <div v-if="!results" class="upload-section">
      <div 
        class="drop-zone" 
        @dragover.prevent 
        @drop.prevent="handleDrop"
        @click="$refs.fileInput.click()"
      >
        <span class="icon">📂</span>
        <p>Drop your WordPress <strong>user_export.csv</strong> here</p>
        <span class="subtext">or click to browse</span>
        <input 
          ref="fileInput" 
          type="file" 
          accept=".csv" 
          class="hidden-input"
          @change="handleFileSelect"
        >
      </div>
    </div>

    <div v-else class="results-section">
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="val">{{ results.wpTotal }}</div>
          <div class="lbl">WP Users Found</div>
        </div>
        <div class="stat-card match">
          <div class="val">{{ results.matched.length }}</div>
          <div class="lbl">Successfully Matched</div>
        </div>
        <div class="stat-card warn">
          <div class="val">{{ results.wpOnly.length }}</div>
          <div class="lbl">In WP, Not in App</div>
        </div>
        <div class="stat-card info">
          <div class="val">{{ results.appOnly.length }}</div>
          <div class="lbl">In App, Not in WP</div>
        </div>
      </div>

      <div class="action-bar">
        <button @click="downloadExport" class="btn-primary">
          ⬇️ Download Import File for WordPress
        </button>
        <button @click="reset" class="btn-text">
          Start Over
        </button>
      </div>

      <div class="tables-grid">
        
        <div class="problem-table">
          <h3>⚠️ In WP, Missing in App</h3>
          <p class="desc">These users exist on the website but aren't in your database.</p>
          
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in results.wpOnly" :key="u.username">
                  <td>{{ u.username }}</td>
                  <td>{{ u.email }}</td>
                  <td>{{ u.first_name }} {{ u.last_name }}</td>
                </tr>
                <tr v-if="results.wpOnly.length === 0">
                  <td colspan="3" class="empty">All WP users matched!</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="problem-table">
          <h3>ℹ️ In App, Missing in WP</h3>
          <p class="desc">These members have hours/data but no website account yet.</p>
          
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in results.appOnly" :key="m.id">
                  <td>{{ m.FirstName }} {{ m.LastName }}</td>
                  <td>{{ m.Email }}</td>
                  <td>{{ getHours(m.Email) }}</td>
                </tr>
                <tr v-if="results.appOnly.length === 0">
                  <td colspan="3" class="empty">All App members have WP accounts!</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Papa from 'papaparse'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const membersStore = useMembersStore()
const logsStore = useLogsStore()
const fileInput = ref(null)
const results = ref(null)

onMounted(async () => {
  // Ensure we have fresh data for calculation
  await Promise.all([
    membersStore.initMembers(),
    logsStore.initLogs()
  ])
})

const getHours = (email) => {
  return logsStore.fiscalYearHours[email?.toLowerCase()] || 0
}

const handleDrop = (e) => {
  const file = e.dataTransfer.files[0]
  if (file) processFile(file)
}

const handleFileSelect = (e) => {
  const file = e.target.files[0]
  if (file) processFile(file)
}

const processFile = (file) => {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      analyzeData(res.data)
    }
  })
}

const analyzeData = (wpRows) => {
  const matched = []
  const wpOnly = []
  const matchedAppEmails = new Set()

  // 1. Loop through WP Export
  wpRows.forEach(row => {
    const wpEmail = row.email?.trim().toLowerCase()
    const wpFirst = row.first_name?.trim().toLowerCase()
    const wpLast = row.last_name?.trim().toLowerCase()
    
    // Try Email Match
    let appMember = membersStore.getMemberByEmail(wpEmail)

    // Try Name Match if no Email Match
    if (!appMember && wpFirst && wpLast) {
      appMember = membersStore.members.find(m => 
        m.FirstName.toLowerCase() === wpFirst && 
        m.LastName.toLowerCase() === wpLast
      )
    }

    if (appMember) {
      // FOUND: Calculate Hours & Prepare for Export
      matchedAppEmails.add(appMember.Email.toLowerCase())
      
      const hours = getHours(appMember.Email)
      
      matched.push({
        username: row.username,
        email: row.email,
        wpum_vhours: hours,
        wpum_dues: 0 // Default per requirements
      })
    } else {
      // NOT FOUND
      wpOnly.push(row)
    }
  })

  // 2. Find App Members NOT in WP
  const appOnly = membersStore.votingMembers.filter(m => 
    !matchedAppEmails.has(m.Email.toLowerCase())
  )

  results.value = {
    wpTotal: wpRows.length,
    matched,
    wpOnly,
    appOnly
  }
}

const downloadExport = () => {
  if (!results.value) return

  const csv = Papa.unparse(results.value.matched)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `wp_update_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const reset = () => {
  results.value = null
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<style scoped>
.wp-sync-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: system-ui, sans-serif;
  color: #1f2937;
}

.page-header { margin-bottom: 2rem; }
.page-header h1 { font-size: 1.875rem; font-weight: 800; margin: 0; }
.page-header p { color: #6b7280; }

/* Upload State */
.drop-zone {
  border: 3px dashed #d1d5db;
  border-radius: 1rem;
  padding: 4rem 2rem;
  text-align: center;
  background-color: #f9fafb;
  cursor: pointer;
  transition: all 0.2s;
}
.drop-zone:hover { border-color: #4f46e5; background-color: #eef2ff; }
.drop-zone .icon { font-size: 3rem; display: block; margin-bottom: 1rem; }
.drop-zone p { font-size: 1.25rem; font-weight: 600; margin: 0; }
.subtext { color: #9ca3af; }
.hidden-input { display: none; }

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}
@media (min-width: 768px) {
  .stats-grid { grid-template-columns: repeat(4, 1fr); }
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  padding: 1rem;
  border-radius: 0.5rem;
  text-align: center;
}
.stat-card .val { font-size: 1.5rem; font-weight: 800; }
.stat-card .lbl { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; }

.match .val { color: #16a34a; }
.warn .val { color: #ca8a04; }
.info .val { color: #2563eb; }

/* Action Bar */
.action-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 2rem;
}

.btn-primary {
  background-color: #4f46e5;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:hover { background-color: #4338ca; }

.btn-text {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  text-decoration: underline;
}

/* Tables */
.tables-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}
@media (min-width: 1024px) {
  .tables-grid { grid-template-columns: 1fr 1fr; }
}

.problem-table h3 { margin: 0 0 0.25rem 0; font-size: 1.1rem; }
.problem-table .desc { margin: 0 0 1rem 0; font-size: 0.85rem; color: #6b7280; }

.table-wrapper {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  max-height: 400px;
  overflow-y: auto;
}

table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th { background: #f9fafb; padding: 0.5rem; text-align: left; font-weight: 600; color: #374151; position: sticky; top: 0; }
td { padding: 0.5rem; border-top: 1px solid #f3f4f6; }
.empty { text-align: center; color: #9ca3af; padding: 2rem; font-style: italic; }
</style>