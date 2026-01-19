import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore'

export const useLogsStore = defineStore('logs', {
  state: () => ({
    logs: [],
    loading: false
  }),

  getters: {
    // ... existing getters
    hoursByMember: (state) => {
      const hoursMap = {}
      state.logs.forEach(log => {
        const email = log.MemberEmail || 'unknown'
        const hrs = Number(log.Hours) || 0
        if (!hoursMap[email]) hoursMap[email] = 0
        hoursMap[email] += hrs
      })
      return hoursMap
    },
    getLogsBySheet: (state) => (sheetShortId) => {
      // Filter by the 4-digit code (string)
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
      // Clean Data
      const cleanLog = {
        MemberEmail: logData.MemberEmail,
        MemberName: logData.MemberName || '', // Optional, UI can fill this
        Date: Timestamp.fromDate(new Date(logData.Date)),
        Activity: logData.Activity,
        Hours: Number(logData.Hours),
        type: logData.type || 'Regular', // Lowercase 'type' per your request
        SourceSheet: logData.SourceSheet || 'none',
        Status: 'approved', // Auto-approve admin entry
        FiscalYearRollover: 'No'
      }
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
        delete updateData.id // Don't save ID inside the doc
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
        const docRef = doc(collection(db, 'logs')) // Auto-ID
        batch.set(docRef, {
          ...log,
          Date: Timestamp.fromDate(new Date(log.Date)),
          SourceSheet: sheetId,
          Status: 'approved',
          FiscalYearRollover: 'No'
        })
      })

      await batch.commit()
    }
  }
})