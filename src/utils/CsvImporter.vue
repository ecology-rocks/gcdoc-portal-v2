<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800">Data Importer</h1>
      <p class="text-gray-500">Bulk upload Members or Logs from CSV.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      
      <div class="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 class="font-bold text-lg mb-4 flex items-center gap-2">
          <span>👥</span> Import Members
        </h2>
        <input 
          type="file" 
          accept=".csv" 
          @change="(e) => parseCsv(e, 'members')"
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        >
        <div v-if="importType === 'members'" class="mt-4">
          <div v-if="parsing" class="text-sm text-gray-500">Parsing CSV...</div>
          <div v-if="parsedData.length > 0" class="space-y-3">
            <p class="text-sm font-bold text-green-600">{{ parsedData.length }} members found.</p>
            <button 
              @click="uploadMembers" 
              :disabled="uploading"
              class="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {{ uploading ? `Uploading... (${progress}%)` : 'Start Import' }}
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 class="font-bold text-lg mb-4 flex items-center gap-2">
          <span>📝</span> Import Logs
        </h2>
        <input 
          type="file" 
          accept=".csv" 
          @change="(e) => parseCsv(e, 'logs')"
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        >
        <div v-if="importType === 'logs'" class="mt-4">
          <div v-if="parsing" class="text-sm text-gray-500">Parsing CSV...</div>
          <div v-if="parsedData.length > 0" class="space-y-3">
            <p class="text-sm font-bold text-green-600">{{ parsedData.length }} logs found.</p>
            
            <div class="bg-yellow-50 p-2 text-xs text-yellow-800 border border-yellow-200 rounded">
              <strong>Note:</strong> Preserves all fields: clockHours, isMaintenance, Status, etc.
            </div>

            <button 
              @click="uploadLogs" 
              :disabled="uploading"
              class="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {{ uploading ? `Uploading... (${progress}%)` : 'Start Import' }}
            </button>
          </div>
        </div>
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
import { ref } from 'vue'
import Papa from 'papaparse'
import { db } from '@/firebase'
import { collection, writeBatch, doc, Timestamp } from 'firebase/firestore'

const parsing = ref(false)
const uploading = ref(false)
const importType = ref(null) // 'members' or 'logs'
const parsedData = ref([])
const progress = ref(0)
const errorLog = ref([])

// 1. CSV PARSER
const parseCsv = (event, type) => {
  const file = event.target.files[0]
  if (!file) return

  parsing.value = true
  importType.value = type
  parsedData.value = []
  errorLog.value = []
  progress.value = 0

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      parsedData.value = results.data
      parsing.value = false
      console.log(`Parsed ${results.data.length} rows for ${type}`)
    },
    error: (err) => {
      errorLog.value.push("CSV Parse Error: " + err.message)
      parsing.value = false
    }
  })
}

// 2. HELPER: CHUNK ARRAY (Firebase Limit 500)
const chunkArray = (arr, size) => {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// 3. UPLOAD MEMBERS
const uploadMembers = async () => {
  uploading.value = true
  const chunks = chunkArray(parsedData.value, 400)
  let processed = 0

  for (const chunk of chunks) {
    const batch = writeBatch(db)
    
    chunk.forEach(row => {
      const email = row['Email']?.trim() || row['email']?.trim()
      
      if (email) {
        const docRef = doc(db, 'members', email.toLowerCase())
        batch.set(docRef, {
          FirstName: row['First Name'] || row['FirstName'] || '',
          LastName: row['Last Name'] || row['LastName'] || '',
          Email: email,
          Phone: row['Phone'] || '',
          Role: row['Role'] || 'member', 
          legacyId: row['ID'] || null
        }, { merge: true }) 
      }
    })

    try {
      await batch.commit()
      processed += chunk.length
      progress.value = Math.round((processed / parsedData.value.length) * 100)
    } catch (e) {
      console.error(e)
      errorLog.value.push(`Batch Failed: ${e.message}`)
    }
  }
  uploading.value = false
  if (errorLog.value.length === 0) alert('Members Import Complete!')
}

// 4. UPLOAD LOGS (FULL FIDELITY)
const uploadLogs = async () => {
  uploading.value = true
  const chunks = chunkArray(parsedData.value, 400)
  let processed = 0

  for (const chunk of chunks) {
    const batch = writeBatch(db)
    
    chunk.forEach(row => {
      // 1. Key Fields
      const email = row['MemberEmail'] || row['Email']
      const hours = parseFloat(row['Hours']) || 0
      
      // 2. Date Conversion
      let dateObj = new Date()
      if (row['Date']) {
        dateObj = new Date(row['Date'])
      }

      // 3. Boolean/Number Conversions
      const clockHours = parseFloat(row['clockHours']) || hours // Fallback to 'Hours' if clockHours is blank
      
      // Handle 'TRUE' string from CSV
      let isMaint = false
      if (row['isMaintenance']) {
        const val = row['isMaintenance'].toString().toUpperCase()
        isMaint = val === 'TRUE'
      }

      if (email) {
        const newLogRef = doc(collection(db, 'logs'))
        batch.set(newLogRef, {
          // IDs
          MemberEmail: email,
          MemberName: row['MemberName'] || '', // Store Name too
          
          // Time
          Date: Timestamp.fromDate(dateObj),
          Hours: hours,        // Credited Hours (Multiplied)
          clockHours: clockHours, // Actual Clock Hours (Base)
          
          // Activity & Type
          Activity: row['Activity'] || '',
          type: row['type'] || '', // Keep blank if blank
          isMaintenance: isMaint,
          
          // Metadata
          SourceSheet: row['SourceSheet'] || 'legacy_csv',
          Status: row['Status'] || 'approved',
          FiscalYearRollover: row['FiscalYearRollover'] || 'No',
          
          importedAt: Timestamp.now()
        })
      }
    })

    try {
      await batch.commit()
      processed += chunk.length
      progress.value = Math.round((processed / parsedData.value.length) * 100)
    } catch (e) {
      console.error(e)
      errorLog.value.push(`Batch Failed: ${e.message}`)
    }
  }
  uploading.value = false
  if (errorLog.value.length === 0) alert('Logs Import Complete!')
}
</script>