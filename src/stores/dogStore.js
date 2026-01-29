import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, arrayUnion, arrayRemove, writeBatch, Timestamp } from 'firebase/firestore'
import { useAuthStore } from '@/stores/authStore'

export const useDogStore = defineStore('dogs', {
  state: () => ({
    dogs: [],
    loading: false
  }),

  getters: {
    getDogsByOwner: (state) => (ownerId) => {
      if (!ownerId) return []
      return state.dogs.filter(d => d.ownerId?.toLowerCase() === ownerId?.toLowerCase())
    },
    getDogById: (state) => (id) => {
      return state.dogs.find(d => d.id === id)
    }
  },

  actions: {
    // --- FETCHING ---
    async fetchDogsForOwner(ownerId) {
       if(!ownerId) return
       this.loading = true
       const q = query(collection(db, 'dogs'), where('ownerId', '==', ownerId.toLowerCase()))
       const snap = await getDocs(q)
       const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }))
       
       fetched.forEach(dog => {
         const idx = this.dogs.findIndex(d => d.id === dog.id)
         if(idx === -1) this.dogs.push(dog)
         else this.dogs[idx] = dog
       })
       this.loading = false
    },

    async fetchDogsForClass(studentIds) {
      if (!studentIds || studentIds.length === 0) return
      this.loading = true
      
      // Firestore 'in' query limit is 10. 
      // For production safety, we slice to 10 here.
      const safeIds = studentIds.slice(0, 10) 

      const q = query(collection(db, 'dogs'), where('ownerId', 'in', safeIds))
      const snap = await getDocs(q)
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      fetched.forEach(dog => {
        const index = this.dogs.findIndex(d => d.id === dog.id)
        if (index === -1) this.dogs.push(dog)
        else this.dogs[index] = dog
      })
      this.loading = false
    },

    // --- BASIC DOG CRUD ---
    async addDog(dogData) {
      const auth = useAuthStore()
      const newRef = doc(collection(db, 'dogs'))
      
      const payload = {
        id: newRef.id,
        name: dogData.name || '',
        breed: dogData.breed || '',
        birthdate: dogData.birthdate || '', 
        sex: dogData.sex || 'U',
        neutered: !!dogData.neutered, 
        ownerId: dogData.ownerId,
        
        vaccinations: [],
        notes: [],
        
        createdAt: Timestamp.now(),
        createdBy: auth.user?.email || 'system'
      }

      await setDoc(newRef, payload)
      this.dogs.push(payload)
    },

    async updateDog(id, dogData) {
      const docRef = doc(db, 'dogs', id)
      // Only update fields passed in dogData
      await updateDoc(docRef, dogData)
      
      const index = this.dogs.findIndex(d => d.id === id)
      if (index !== -1) {
        this.dogs[index] = { ...this.dogs[index], ...dogData }
      }
    },

    async deleteDog(id) {
      await deleteDoc(doc(db, 'dogs', id))
      this.dogs = this.dogs.filter(d => d.id !== id)
    },

    // [NEW] Bulk Delete for Member Cleanup
    async deleteDogsByOwner(ownerId) {
      if (!ownerId) return
      
      const q = query(collection(db, 'dogs'), where('ownerId', '==', ownerId.toLowerCase()))
      const snap = await getDocs(q)
      
      if (snap.empty) return

      const batch = writeBatch(db)
      snap.docs.forEach(d => {
        batch.delete(d.ref)
      })
      await batch.commit()

      // Update local state
      this.dogs = this.dogs.filter(d => d.ownerId !== ownerId.toLowerCase())
    },

    // --- VACCINATIONS CRUD ---
    async addVaccination(dogId, vax) {
      const auth = useAuthStore()
      const dogRef = doc(db, 'dogs', dogId)
      
      // Use simple random ID generation safe for client-side
      const newVax = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name: vax.name,
        dateGiven: vax.dateGiven,
        dateDue: vax.dateDue,
        addedBy: auth.user?.email || 'system',
        addedAt: new Date().toISOString()
      }

      await updateDoc(dogRef, {
        vaccinations: arrayUnion(newVax)
      })

      // Update Local
      const dog = this.dogs.find(d => d.id === dogId)
      if (dog) {
        if (!dog.vaccinations) dog.vaccinations = []
        dog.vaccinations.push(newVax)
      }
    },

    async deleteVaccination(dogId, vaxId) {
      const dog = this.dogs.find(d => d.id === dogId)
      if (!dog) return

      const vaxToRemove = dog.vaccinations.find(v => v.id === vaxId)
      if (!vaxToRemove) return

      const dogRef = doc(db, 'dogs', dogId)
      await updateDoc(dogRef, {
        vaccinations: arrayRemove(vaxToRemove)
      })

      dog.vaccinations = dog.vaccinations.filter(v => v.id !== vaxId)
    },

    // --- NOTES CRUD ---
    async addNote(dogId, text) {
      const auth = useAuthStore()
      const dogRef = doc(db, 'dogs', dogId)
      
      const newNote = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        text: text,
        author: auth.user?.email || 'system',
        timestamp: new Date().toISOString(), 
        updatedAt: null
      }

      await updateDoc(dogRef, {
        notes: arrayUnion(newNote)
      })

      const dog = this.dogs.find(d => d.id === dogId)
      if (dog) {
        if (!dog.notes) dog.notes = []
        dog.notes.push(newNote)
      }
    },

    async deleteNote(dogId, noteId) {
      const dog = this.dogs.find(d => d.id === dogId)
      if (!dog) return

      const noteToRemove = dog.notes.find(n => n.id === noteId)
      if (!noteToRemove) return

      const dogRef = doc(db, 'dogs', dogId)
      await updateDoc(dogRef, {
        notes: arrayRemove(noteToRemove)
      })

      dog.notes = dog.notes.filter(n => n.id !== noteId)
    },

    // --- IMPORT/EXPORT ---
    async importGenericRows(rows) {
      // 1. Load all dogs to check for duplicates (efficient for <2000 dogs)
      // Force fetch to ensure duplicate check is accurate against DB
      const q = query(collection(db, 'dogs'))
      const snap = await getDocs(q)
      const existingDogs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      const batch = writeBatch(db)
      let count = 0
      
      rows.forEach(row => {
        if (row['Name'] && row['OwnerEmail']) {
          const name = row['Name'].trim()
          const ownerId = row['OwnerEmail'].trim().toLowerCase()

          // 2. CHECK FOR DUPLICATES (Match Name + Owner)
          const match = existingDogs.find(d => 
            d.name.toLowerCase() === name.toLowerCase() && 
            d.ownerId === ownerId
          )

          const docRef = match 
            ? doc(db, 'dogs', match.id)
            : doc(collection(db, 'dogs'))

          // Parse Booleans/Dates
          const neuteredRaw = (row['Neutered'] || '').toString().toLowerCase()
          const isNeutered = ['yes', 'true', '1', 'y'].includes(neuteredRaw)

          const payload = {
            id: docRef.id,
            name: name,
            breed: row['Breed'] || 'Unknown',
            ownerId: ownerId,
            sex: row['Sex'] || 'U',
            birthdate: row['Birthdate'] || '',
            neutered: isNeutered,
            // Only overwrite creation date/arrays if new
            ...(match ? {} : { createdAt: Timestamp.now(), vaccinations: [], notes: [] })
          }

          batch.set(docRef, payload, { merge: true })
          count++
        }
      })
      await batch.commit()
      return count
    },

    async getExportData() {
      // Fetch fresh data for export
      const q = query(collection(db, 'dogs'))
      const snap = await getDocs(q)
      
      return snap.docs.map(d => {
        const data = d.data()
        return {
          Name: data.name,
          Breed: data.breed,
          OwnerEmail: data.ownerId,
          Sex: data.sex || 'U',
          Birthdate: data.birthdate || '',
          Neutered: data.neutered ? 'Yes' : 'No'
        }
      })
    }
  }
})