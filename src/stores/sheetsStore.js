import { defineStore } from 'pinia'
import { db, storage } from '@/firebase'
// ADDED: onSnapshot
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

export const useSheetsStore = defineStore('sheets', {
  state: () => ({
    sheets: [],
    loading: false
  }),

  actions: {
    async initSheets() {
      this.loading = true
      const q = query(collection(db, 'sheets'), orderBy('uploadedAt', 'desc'))
      
      // Real-time listener
      onSnapshot(q, (snapshot) => {
         this.sheets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
         this.loading = false
      })
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
    }
  }
})