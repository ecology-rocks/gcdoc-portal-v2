import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore'
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
            if (!ownerId) return
            this.loading = true
            const q = query(collection(db, 'dogs'), where('ownerId', '==', ownerId.toLowerCase()))
            const snap = await getDocs(q)
            const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }))

            fetched.forEach(dog => {
                const idx = this.dogs.findIndex(d => d.id === dog.id)
                if (idx === -1) this.dogs.push(dog)
                else this.dogs[idx] = dog
            })
            this.loading = false
        },

        async fetchDogsForClass(studentIds) {
            if (!studentIds || studentIds.length === 0) return
            this.loading = true
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

        // --- VACCINATIONS CRUD ---
        async addVaccination(dogId, vax) {
            const auth = useAuthStore()
            const dogRef = doc(db, 'dogs', dogId)

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
                // Safer ID gen than crypto.randomUUID() for some browsers
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
            const batch = require('firebase/firestore').writeBatch(db)
            let count = 0

            rows.forEach(row => {
                if (row['Name'] && row['OwnerEmail']) {
                    const newDocRef = doc(collection(db, 'dogs'))
                    batch.set(newDocRef, {
                        id: newDocRef.id,
                        name: row['Name'],
                        breed: row['Breed'] || 'Unknown',
                        ownerId: row['OwnerEmail'].trim().toLowerCase(),

                        // [UPDATED] New Fields
                        sex: row['Sex'] || 'U',
                        birthdate: row['Birthdate'] || '',
                        neutered: isNeutered,

                        createdAt: Timestamp.now(),
                        vaccinations: [],
                        notes: []
                    })
                    count++
                }
            })
            await batch.commit()
            return count
        },

        async getExportData() {
            const q = query(collection(db, 'dogs'))
            const snap = await getDocs(q)
            return snap.docs.map(d => {
                const data = d.data()
                return {
                    Name: data.name,
                    Breed: data.breed,
                    OwnerEmail: data.ownerId,
                    // [UPDATED] New Fields
                    Sex: data.sex || 'U',
                    Birthdate: data.birthdate || '',
                    Neutered: data.neutered ? 'Yes' : 'No'
                }
            })
        }
    }
})