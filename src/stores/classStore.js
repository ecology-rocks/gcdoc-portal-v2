import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, getDocs, query, writeBatch, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { useAuthStore } from '@/stores/authStore'

export const useClassStore = defineStore('classes', {
  state: () => ({
    classes: [],
    loading: false,
    sessions: [
      '1 (Jan/Feb)', 
      '2 (Mar/Apr)', 
      '3 (May/Jun)', 
      '4 (Aug/Sep)', 
      '5 (Oct/Nov)'
    ],
    // [NEW] Days of Week
    days: [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ],
    locations: [
      'Front Room', 'Agility Room', 'The Land'
    ]
  }),

  getters: {
    availableYears: () => {
      const current = new Date().getFullYear()
      return [current - 1, current, current + 1, current + 2, current + 3]
    },

    myClasses: (state) => {
      const auth = useAuthStore()
      if (!auth.user?.email) return []

      if (auth.profile?.isAdmin) {
        return state.classes
      }

      return state.classes.filter(c => 
        c.teachers && c.teachers.includes(auth.user.email.toLowerCase())
      )
    },
    
    isTeacher: (state) => {
      const auth = useAuthStore()
      if (auth.profile?.isAdmin) return true
      return state.myClasses.length > 0
    }
  },

  actions: {
    async initClasses() {
      this.loading = true
      const q = query(collection(db, 'classes'))
      const snap = await getDocs(q)
      this.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      this.loading = false
    },

    async addClass(classData) {
      const payload = {
        name: classData.name,
        session: classData.session || '',
        year: parseInt(classData.year) || new Date().getFullYear(),
        
        // [UPDATED] Day and Time separate
        day: classData.day || 'Monday',
        time: classData.time || '', // Stores HH:mm format
        
        location: classData.location || '',
        teachers: classData.teachers || [],
        students: classData.students || [],
        createdAt: Timestamp.now()
      }
      
      const docRef = await addDoc(collection(db, 'classes'), payload)
      this.classes.push({ id: docRef.id, ...payload })
    },

    async updateClass(id, classData) {
      const docRef = doc(db, 'classes', id)
      
      const payload = {
        name: classData.name,
        session: classData.session,
        year: parseInt(classData.year),
        day: classData.day, // [UPDATED]
        time: classData.time, // [UPDATED]
        location: classData.location,
        teachers: classData.teachers,
        students: classData.students
      }

      await updateDoc(docRef, payload)

      const index = this.classes.findIndex(c => c.id === id)
      if (index !== -1) {
        this.classes[index] = { ...this.classes[index], ...payload }
      }
    },

    async deleteClass(id) {
      await deleteDoc(doc(db, 'classes', id))
      this.classes = this.classes.filter(c => c.id !== id)
    },

    // --- IMPORT/EXPORT ---
    async importGenericRows(rows) {
      const batch = writeBatch(db)
      let count = 0

      rows.forEach(row => {
        if (row['Name']) {
          const newDocRef = doc(collection(db, 'classes'))
          
          const parseList = (str) => (!str ? [] : str.split(/[;,]+/).map(s => s.trim().toLowerCase()).filter(s => s))
          const teacherEmails = parseList(row['Teachers'])
          const studentEmails = parseList(row['Students'])
          const studentObjects = studentEmails.map(email => ({ email: email, name: email }))

          batch.set(newDocRef, {
            id: newDocRef.id,
            name: row['Name'],
            session: row['Session'] || '',
            year: parseInt(row['Year']) || new Date().getFullYear(),
            
            // [UPDATED] Import separate fields
            day: row['Day'] || 'Monday',
            time: row['Time'] || '',
            
            location: row['Location'] || '',
            teachers: teacherEmails,
            students: studentObjects,
            createdAt: new Date()
          })
          count++
        }
      })
      await batch.commit()
      return count
    },

    async getExportData() {
      await this.initClasses()
      return this.classes.map(d => ({
        Name: d.name,
        Session: d.session,
        Year: d.year,
        Day: d.day, // [NEW]
        Time: d.time,
        Location: d.location,
        Teachers: (d.teachers || []).join(', '),
        Students: (d.students || []).map(s => s.email).join(', ')
      }))
    }
  }
})