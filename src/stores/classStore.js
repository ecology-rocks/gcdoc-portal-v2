import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, getDocs, query, writeBatch, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { useAuthStore } from '@/stores/authStore'

export const useClassStore = defineStore('classes', {
  state: () => ({
    classes: [],
    loading: false,
    sessions: [
      'Jan-Feb', 'Mar-April', 'May-Jun', 'Aug-Sep', 'Oct-Nov'
    ],
    locations: [
      'Front Room', 'Agility Room', 'The Land'
    ]
  }),

  getters: {
    myClasses: (state) => {
      const auth = useAuthStore()
      if (!auth.user?.email) return []

      // Admin Override
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
      // Always fetch fresh to ensure CRUD updates are seen
      this.loading = true
      const q = query(collection(db, 'classes'))
      const snap = await getDocs(q)
      this.classes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      this.loading = false
    },

    // --- CRUD ACTIONS ---

    async addClass(classData) {
      const payload = {
        name: classData.name,
        session: classData.session || '',
        location: classData.location || '',
        time: classData.time || '',
        teachers: classData.teachers || [], // Array of emails
        students: classData.students || [], // Array of objects { email, name }
        createdAt: Timestamp.now()
      }
      
      const docRef = await addDoc(collection(db, 'classes'), payload)
      
      // Update local state
      this.classes.push({ id: docRef.id, ...payload })
    },

    async updateClass(id, classData) {
      const docRef = doc(db, 'classes', id)
      
      const payload = {
        name: classData.name,
        session: classData.session,
        location: classData.location,
        time: classData.time,
        teachers: classData.teachers,
        students: classData.students
      }

      await updateDoc(docRef, payload)

      // Update local state
      const index = this.classes.findIndex(c => c.id === id)
      if (index !== -1) {
        this.classes[index] = { ...this.classes[index], ...payload }
      }
    },

    async deleteClass(id) {
      await deleteDoc(doc(db, 'classes', id))
      this.classes = this.classes.filter(c => c.id !== id)
    },

    // --- IMPORT / EXPORT ---

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
            location: row['Location'] || '',
            time: row['Time'] || '',
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
      // Ensure we have latest
      await this.initClasses()
      return this.classes.map(d => ({
        Name: d.name,
        Session: d.session,
        Location: d.location,
        Time: d.time,
        Teachers: (d.teachers || []).join(', '),
        Students: (d.students || []).map(s => s.email).join(', ')
      }))
    }
  }
})