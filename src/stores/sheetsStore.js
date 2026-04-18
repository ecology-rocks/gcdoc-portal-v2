import { defineStore } from 'pinia'
import { db, storage } from '@/firebase'
import { useAuthStore } from '@/stores/authStore'
// ADDED: onSnapshot
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

export const useSheetsStore = defineStore('sheets', {
  state: () => ({
    sheets: [],
    loading: false,
    error: null,
    unsubscribeSheets: null
  }),

  actions: {
    async initSheets() {
      if (this.unsubscribeSheets) return

      const authStore = useAuthStore()
      if (authStore.loading) await authStore.init()

      if (!authStore.isAdmin) {
        this.loading = false
        this.sheets = []
        this.error = 'Admin access required to view sheets.'
        return
      }

      this.loading = true
      this.error = null
      const q = query(collection(db, 'sheets'), orderBy('uploadedAt', 'desc'))
      
      // Real-time listener
      this.unsubscribeSheets = onSnapshot(
        q,
        (snapshot) => {
          this.sheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          this.loading = false
        },
        (error) => {
          this.loading = false
          this.error = error?.code === 'permission-denied'
            ? 'You do not have permission to read sheets.'
            : error?.message || 'Unable to load sheets.'
          if (error?.code === 'permission-denied') {
            this.sheets = []
          }
        }
      )
    },

    stopSheetsListener() {
      if (this.unsubscribeSheets) {
        this.unsubscribeSheets()
        this.unsubscribeSheets = null
      }
    },

    async uploadSheet(file, uploaderEmail) {
       const shortId = Math.floor(1000 + Math.random() * 9000).toString()
       const filename = `sheets/${Date.now()}_${shortId}_${file.name}`
       const fileRef = storageRef(storage, filename)
       const uploadResult = await uploadBytes(fileRef, file)
       const downloadURL = await getDownloadURL(uploadResult.ref)

       const newSheet = {
        shortId: shortId,
        imageUrl: downloadURL,
        storagePath: filename,
        uploadedAt: new Date(),
        uploadedBy: uploaderEmail,
        status: 'pending',
        logCount: 0
      }
      
      const docRef = await addDoc(collection(db, 'sheets'), newSheet)
      return { id: docRef.id, ...newSheet }
    },

    async updateSheetStatus(sheetId, status) {
      await updateDoc(doc(db, 'sheets', sheetId), { status })
    },
    
    async updateLogCount(sheetId, count) {
        await updateDoc(doc(db, 'sheets', sheetId), { logCount: count })
    },
    async updateSheetRotation(sheetId, rotation) {
      await updateDoc(doc(db, 'sheets', sheetId), { rotation })
    },
  }
})