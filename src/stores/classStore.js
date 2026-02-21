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

    // Updated: Returns classes where user is Teacher OR Student
    myClasses: (state) => {
      const auth = useAuthStore()
      if (!auth.user?.email) return []

      // Admin sees ALL classes in their dashboard views
      if (auth.profile?.isAdmin) {
        return state.classes
      }

      const myEmail = auth.user.email.toLowerCase()
      
      return state.classes.filter(c => {
        const isTeacher = c.teachers && c.teachers.includes(myEmail)
        const isStudent = c.students && c.students.some(s => s.email.toLowerCase() === myEmail)
        return isTeacher || isStudent
      })
    },
    
    // Helper to check role for a specific class
    isTeacherOf: (state) => (classId) => {
      const auth = useAuthStore()
      if (auth.profile?.isAdmin) return true // Admin acts as teacher
      const cls = state.classes.find(c => c.id === classId)
      return cls?.teachers?.includes(auth.user?.email?.toLowerCase())
    },

    isStudentOf: (state) => (classId) => {
      const auth = useAuthStore()
      const cls = state.classes.find(c => c.id === classId)
      return cls?.students?.some(s => s.email.toLowerCase() === auth.user?.email?.toLowerCase())
    },

    isTeacher: (state) => {
      const auth = useAuthStore()
      if (auth.profile?.isAdmin) return true
      // Check if they teach ANY class
      return state.classes.some(c => c.teachers?.includes(auth.user?.email?.toLowerCase()))
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
        day: classData.day || 'Monday',
        time: classData.time || '',
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
        day: classData.day,
        time: classData.time,
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

    async importGenericRows(rows) {
      if (this.classes.length === 0) {
        await this.initClasses()
      }

      const batch = writeBatch(db)
      let count = 0

      rows.forEach(row => {
        if (row['Name']) {
          const name = row['Name'].trim()
          const year = parseInt(row['Year']) || new Date().getFullYear()
          const session = row['Session']?.trim() || ''

          const existingClass = this.classes.find(c => 
            c.name.toLowerCase() === name.toLowerCase() && 
            c.year === year &&
            c.session.toLowerCase() === session.toLowerCase()
          )

          const docRef = existingClass 
            ? doc(db, 'classes', existingClass.id)
            : doc(collection(db, 'classes'))
          
          const parseList = (str) => (!str ? [] : str.split(/[;,]+/).map(s => s.trim().toLowerCase()).filter(s => s))
          const teacherEmails = parseList(row['Teachers'])
          const studentEmails = parseList(row['Students'])
          const studentObjects = studentEmails.map(email => ({ email: email, name: email }))

          const payload = {
            id: docRef.id, 
            name: name,
            session: session,
            year: year,
            day: row['Day'] || 'Monday',
            time: row['Time'] || '',
            location: row['Location'] || '',
            teachers: teacherEmails,
            students: studentObjects,
            ...(existingClass ? {} : { createdAt: Timestamp.now() })
          }

          batch.set(docRef, payload, { merge: true })
          count++
        }
      })
      
      await batch.commit()
      await this.initClasses()
      return count
    },

    async getExportData() {
      await this.initClasses()
      return this.classes.map(d => ({
        Name: d.name,
        Year: d.year,
        Session: d.session,
        Day: d.day,
        Time: d.time,
        Location: d.location,
        Teachers: (d.teachers || []).join(', '),
        Students: (d.students || []).map(s => s.email).join(', ')
      }))
    }
  }
})