import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, Timestamp, getDocs, query } from 'firebase/firestore'

export const useLogsStore = defineStore('logs', {
  state: () => ({
    logs: [],
    loading: false
  }),

  getters: {
    // 1. All-Time Total (Lifetime Hours)
    totalHoursByMember: (state) => {
      const hoursMap = {}
      state.logs.forEach(log => {
        const email = log.MemberEmail || 'unknown'
        const hrs = Number(log.Hours) || 0
        if (!hoursMap[email]) hoursMap[email] = 0
        hoursMap[email] += hrs
      })
      return hoursMap
    },

    // 2. [NEW] Fiscal Year Total (Oct 1 - Sept 30)
    fiscalYearHours: (state) => {
      const hoursMap = {}
      const now = new Date()
      const currentMonth = now.getMonth() // 0 = Jan, 9 = Oct
      const currentYear = now.getFullYear()

      // Logic: If we are in Jan-Sept (0-8), FY started Oct 1 of previous year.
      // If we are in Oct-Dec (9-11), FY started Oct 1 of current year.
      const startYear = currentMonth >= 9 ? currentYear : currentYear - 1
      
      const startDate = new Date(startYear, 9, 1) // Oct 1
      const endDate = new Date(startYear + 1, 9, 1) // Oct 1 Next Year

      state.logs.forEach(log => {
        // Handle Firestore Timestamp or JS Date
        const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date)
        
        if (d >= startDate && d < endDate) {
          const email = log.MemberEmail || 'unknown'
          const hrs = Number(log.Hours) || 0
          if (!hoursMap[email]) hoursMap[email] = 0
          hoursMap[email] += hrs
        }
      })
      return hoursMap
    },

    getLogsBySheet: (state) => (sheetShortId) => {
      return state.logs.filter(l => l.SourceSheet == sheetShortId)
    }
  },

  actions: {
    initLogs() {
      this.loading = true
      onSnapshot(collection(db, 'logs'), (snapshot) => {
        this.logs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
             const dateA = a.Date?.seconds || 0
             const dateB = b.Date?.seconds || 0
             return dateB - dateA
          })
        this.loading = false
      })
    },

    async addLog(logData) {
      await addDoc(collection(db, 'logs'), {
        ...logData,
        Date: Timestamp.fromDate(new Date(logData.Date)),
        Status: 'approved',
        FiscalYearRollover: 'No'
      })
    },

    async batchSave(newLogs, updatedLogs, sheetId) {
      const batch = writeBatch(db)
      
      // 1. Handle New Logs
      newLogs.forEach(log => {
        const docRef = doc(collection(db, 'logs'))
        batch.set(docRef, {
          ...log,
          Date: Timestamp.fromDate(new Date(log.Date)),
          SourceSheet: sheetId,
          Status: 'approved',
          FiscalYearRollover: 'No'
        })
      })

      // 2. Handle Updates
      updatedLogs.forEach(log => {
        const docRef = doc(db, 'logs', log.id)
        const updateData = {
           ...log,
           Date: Timestamp.fromDate(new Date(log.Date))
        }
        delete updateData.id 
        batch.update(docRef, updateData)
      })

      await batch.commit()
    },

    async deleteLog(logId) {
      await deleteDoc(doc(db, 'logs', logId))
    },

    async addBulkLogs(logsArray, sheetId) {
      const batch = writeBatch(db)
      
      logsArray.forEach(log => {
        const docRef = doc(collection(db, 'logs'))
        batch.set(docRef, {
          ...log,
          Date: Timestamp.fromDate(new Date(log.Date)),
          SourceSheet: sheetId,
          Status: 'approved',
          FiscalYearRollover: 'No'
        })
      })

      await batch.commit()
    },

    // --- IMPORT / EXPORT ACTIONS ---

    async importGenericRows(rows) {
      const batch = writeBatch(db)
      let count = 0

      rows.forEach(row => {
        const email = row['MemberEmail'] || row['Email']
        
        if (email) {
          // Parse Numbers
          const hours = parseFloat(row['Hours']) || 0
          const clockHours = parseFloat(row['clockHours']) || hours
          
          // Parse Dates
          const importedAt = row['importedAt'] ? new Date(row['importedAt']) : new Date()
          const dateObj = row['Date'] ? new Date(row['Date']) : new Date()
          
          // Parse Booleans
          let isMaint = false
          if (row['isMaintenance']) {
            const val = row['isMaintenance'].toString().toUpperCase()
            isMaint = (val === 'TRUE' || val === 'YES')
          }

          const newLogRef = doc(collection(db, 'logs'))
          
          batch.set(newLogRef, {
            MemberEmail: email,
            MemberName: row['MemberName'] || '',
            Date: Timestamp.fromDate(dateObj),
            importedAt: Timestamp.fromDate(importedAt),
            Hours: hours,
            clockHours: clockHours,
            Activity: row['Activity'] || '',
            type: row['type'] || 'Regular', 
            isMaintenance: isMaint,
            Status: row['Status'] || 'approved',
            SourceSheet: row['SourceSheet'] || '',
            FiscalYearRollover: row['FiscalYearRollover'] || 'No'
          })
          count++
        }
      })

      await batch.commit()
      return count
    },

    async getExportData() {
      const q = query(collection(db, 'logs'))
      const snap = await getDocs(q)
      const rawLogs = snap.docs.map(d => d.data())

      return rawLogs.map(l => ({
        MemberEmail: l.MemberEmail,
        MemberName: l.MemberName,
        Date: l.Date?.toDate ? l.Date.toDate().toISOString() : l.Date,
        Hours: l.Hours,
        clockHours: l.clockHours,
        Activity: l.Activity,
        type: l.type,
        isMaintenance: l.isMaintenance,
        Status: l.Status,
        SourceSheet: l.SourceSheet,
        FiscalYearRollover: l.FiscalYearRollover,
        importedAt: l.importedAt?.toDate ? l.importedAt.toDate().toISOString() : l.importedAt
      }))
    }
  }
})