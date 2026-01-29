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
      // Always fetch fresh to ensure we have the latest list for deduplication
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

    // --- IMPORT/EXPORT ---
    async importGenericRows(rows) {
      // 1. Ensure we have the latest data to check against
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

          // 2. CHECK FOR DUPLICATES
          // We define a "Unique Class" as matching Name + Year + Session
          const existingClass = this.classes.find(c => 
            c.name.toLowerCase() === name.toLowerCase() && 
            c.year === year &&
            c.session.toLowerCase() === session.toLowerCase()
          )

          // 3. If exists, update that ID. If not, create new ID.
          const docRef = existingClass 
            ? doc(db, 'classes', existingClass.id)
            : doc(collection(db, 'classes'))
          
          const parseList = (str) => (!str ? [] : str.split(/[;,]+/).map(s => s.trim().toLowerCase()).filter(s => s))
          const teacherEmails = parseList(row['Teachers'])
          const studentEmails = parseList(row['Students'])
          const studentObjects = studentEmails.map(email => ({ email: email, name: email }))

          const payload = {
            // If it's new, we set ID. If existing, this is ignored by Firestore but harmless.
            id: docRef.id, 
            name: name,
            session: session,
            year: year,
            day: row['Day'] || 'Monday',
            time: row['Time'] || '',
            location: row['Location'] || '',
            teachers: teacherEmails,
            students: studentObjects,
            // Only set createdAt if it's a new record
            ...(existingClass ? {} : { createdAt: Timestamp.now() })
          }

          // 'merge: true' ensures we update fields without wiping the doc if we missed something
          batch.set(docRef, payload, { merge: true })
          count++
        }
      })
      
      await batch.commit()
      
      // Refresh local state to reflect updates
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