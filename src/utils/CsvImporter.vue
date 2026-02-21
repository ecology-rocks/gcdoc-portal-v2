<template>
  <div class="importer-container">
    <div class="importer-header">
      <h1>Data Tools</h1>
      <p>Import and Export club data via CSV.</p>
    </div>

    <div class="tab-list">
      <button 
        v-for="tab in tabs" 
        :key="tab"
        @click="activeTab = tab"
        class="tab-btn"
        :class="{ active: activeTab === tab }"
      >
        {{ tab }}
      </button>
    </div>

    <div class="tool-grid">
      <div class="tool-card">
        <h2 class="card-title">
          <span>📥</span> Import {{ activeTab }}
        </h2>
        
        <div class="format-help">
          <p class="help-label">Expected Columns:</p>
          <div v-if="activeTab === 'members'">Email, FirstName, LastName, Role, Phone1, Address...</div>
          <div v-if="activeTab === 'logs'">MemberEmail, Date, Hours, Activity, isMaintenance...</div>
          <div v-if="activeTab === 'dogs'">Name, OwnerEmail, Breed, Sex (M/F), Birthdate (YYYY-MM-DD), Neutered (Yes/No)</div>
          <div v-if="activeTab === 'classes'">Name, Year, Session, Day, Time, Location, Teachers (emails), Students (emails)</div>
        </div>

        <input 
          type="file" 
          accept=".csv" 
          @change="parseCsv"
          class="file-input"
        >
        
        <div v-if="parsedData.length > 0" class="import-actions">
          <p class="ready-msg">{{ parsedData.length }} records ready.</p>
          <button 
            @click="processImport" 
            :disabled="uploading"
            class="btn-import"
          >
            {{ uploading ? `Processing...` : 'Start Import' }}
          </button>
        </div>
      </div>

      <div class="tool-card">
        <h2 class="card-title">
          <span>📤</span> Export {{ activeTab }}
        </h2>
        <p class="card-desc">
          Download a full CSV of all {{ activeTab }} currently in the database.
        </p>
        <button 
          @click="processExport" 
          :disabled="uploading"
          class="btn-export"
        >
          Download CSV
        </button>
      </div>
    </div>

    <div v-if="errorLog.length > 0" class="error-section">
      <h3>Errors</h3>
      <div class="error-list">
        <div v-for="(err, i) in errorLog" :key="i">{{ err }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import Papa from 'papaparse'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'
import { useDogStore } from '@/stores/dogStore'
import { useClassStore } from '@/stores/classStore'

const tabs = ['members', 'logs', 'dogs', 'classes']
const activeTab = ref('members')
const parsing = ref(false)
const uploading = ref(false)
const parsedData = ref([])
const errorLog = ref([])

const stores = {
  members: useMembersStore(),
  logs: useLogsStore(),
  dogs: useDogStore(),
  classes: useClassStore()
}

watch(activeTab, () => {
  parsedData.value = []
  errorLog.value = []
})

const parseCsv = (event) => {
  const file = event.target.files[0]
  if (!file) return
  parsing.value = true
  parsedData.value = []
  errorLog.value = []

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      parsedData.value = results.data
      parsing.value = false
    },
    error: (err) => {
      errorLog.value.push("CSV Parse Error: " + err.message)
      parsing.value = false
    }
  })
}

const processImport = async () => {
  uploading.value = true
  const currentStore = stores[activeTab.value]
  const chunkSize = 400 
  const chunks = []
  for (let i = 0; i < parsedData.value.length; i += chunkSize) {
    chunks.push(parsedData.value.slice(i, i + chunkSize))
  }

  try {
    let total = 0
    for (const chunk of chunks) {
      const count = await currentStore.importGenericRows(chunk)
      total += count
    }
    alert(`${activeTab.value} Import Complete! Imported ${total} records.`)
    parsedData.value = []
    if (currentStore.initClasses) await currentStore.initClasses()
    if (currentStore.initMembers) await currentStore.initMembers()
  } catch (e) {
    errorLog.value.push(e.message)
  }
  uploading.value = false
}

const processExport = async () => {
  uploading.value = true
  const currentStore = stores[activeTab.value]
  try {
    const data = await currentStore.getExportData()
    if (!data || data.length === 0) {
      alert("No data to export.")
      uploading.value = false
      return
    }
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `${activeTab.value}_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (e) {
    errorLog.value.push("Export Failed: " + e.message)
  }
  uploading.value = false
}
</script>

<style scoped>
.importer-container {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 0 1.5rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.importer-header { margin-bottom: 2rem; }
.importer-header h1 { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0; }
.importer-header p { color: #6b7280; margin: 0.25rem 0 0; }

.tab-list {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.tab-btn {
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  text-transform: capitalize;
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}

.tool-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 768px) {
  .tool-grid { grid-template-columns: 1fr 1fr; }
}

.tool-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: capitalize;
}

.format-help {
  background-color: #f9fafb;
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.help-label { font-weight: 700; color: #374151; margin-bottom: 0.25rem; }

.file-input {
  width: 100%;
  font-size: 0.875rem;
  color: #6b7280;
}

.file-input::-webkit-file-upload-button {
  background: #eff6ff;
  color: #1d4ed8;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 1rem;
}

.import-actions { margin-top: 1.5rem; }
.ready-msg { font-size: 0.875rem; font-weight: 700; color: #16a34a; margin-bottom: 0.75rem; }

.btn-import {
  width: 100%;
  background-color: #4f46e5;
  color: white;
  padding: 0.5rem;
  border-radius: 0.375rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
}

.btn-import:disabled { opacity: 0.5; cursor: not-allowed; }

.card-desc { font-size: 0.875rem; color: #6b7280; margin-bottom: 1.5rem; }

.btn-export {
  width: 100%;
  background: white;
  border: 1px solid #4f46e5;
  color: #4f46e5;
  padding: 0.5rem;
  border-radius: 0.375rem;
  font-weight: 700;
  cursor: pointer;
}

.error-section {
  margin-top: 2rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  padding: 1rem;
  border-radius: 0.5rem;
}

.error-section h3 { color: #b91c1c; font-size: 1rem; margin-top: 0; }
.error-list { font-family: monospace; font-size: 0.75rem; color: #dc2626; max-height: 200px; overflow-y: auto; }
</style>