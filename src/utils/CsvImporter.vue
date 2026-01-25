<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800">Data Tools</h1>
      <p class="text-gray-500">Import and Export club data via CSV.</p>
    </div>

    <div class="flex space-x-2 border-b border-gray-200 mb-6">
      <button 
        v-for="tab in tabs" 
        :key="tab"
        @click="activeTab = tab"
        class="px-4 py-2 text-sm font-medium capitalize transition-colors"
        :class="activeTab === tab ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'"
      >
        {{ tab }}
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      
      <div class="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 class="font-bold text-lg mb-4 flex items-center gap-2 capitalize">
          <span>📥</span> Import {{ activeTab }}
        </h2>
        
        <div class="mb-4 text-xs text-gray-500 bg-gray-50 p-3 rounded font-mono">
          <p class="font-bold mb-1 text-gray-700">Expected Columns:</p>
          
          <div v-if="activeTab === 'members'">
            Email, FirstName, LastName, Role, Phone1, Address...
          </div>
          
          <div v-if="activeTab === 'logs'">
            MemberEmail, Date, Hours, Activity, isMaintenance...
          </div>
          
          <div v-if="activeTab === 'dogs'">
            Name, OwnerEmail, Breed, Sex (M/F), Birthdate (YYYY-MM-DD), Neutered (Yes/No)
          </div>
          
          <div v-if="activeTab === 'classes'">
            Name, Year, Session, Day, Time, Location, Teachers (emails), Students (emails)
          </div>
        </div>

        <input 
          type="file" 
          accept=".csv" 
          @change="parseCsv"
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        >
        
        <div v-if="parsedData.length > 0" class="mt-4 space-y-3">
          <p class="text-sm font-bold text-green-600">
            {{ parsedData.length }} records ready.
          </p>
          <button 
            @click="processImport" 
            :disabled="uploading"
            class="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {{ uploading ? `Processing...` : 'Start Import' }}
          </button>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 class="font-bold text-lg mb-4 flex items-center gap-2 capitalize">
          <span>📤</span> Export {{ activeTab }}
        </h2>
        <p class="text-sm text-gray-500 mb-6">
          Download a full CSV of all {{ activeTab }} currently in the database.
        </p>
        <button 
          @click="processExport" 
          :disabled="uploading"
          class="w-full border border-indigo-600 text-indigo-600 py-2 rounded font-bold hover:bg-indigo-50 disabled:opacity-50 transition-colors"
        >
          Download CSV
        </button>
      </div>
    </div>

    <div v-if="errorLog.length > 0" class="mt-8 bg-red-50 p-4 rounded border border-red-200">
      <h3 class="font-bold text-red-800 mb-2">Errors</h3>
      <div class="max-h-60 overflow-y-auto text-xs font-mono text-red-600">
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

// Stores
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
  
  // Chunking for Firestore
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
    
    // Refresh the store view if applicable
    if (currentStore.initClasses) await currentStore.initClasses()
    if (currentStore.initMembers) await currentStore.initMembers()
    
  } catch (e) {
    console.error(e)
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
    console.error(e)
    errorLog.value.push("Export Failed: " + e.message)
  }
  uploading.value = false
}
</script>