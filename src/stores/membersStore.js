import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, onSnapshot, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'

export const useMembersStore = defineStore('members', {
  state: () => ({
    members: [],
    loading: false
  }),

  getters: {
    getMemberByEmail: (state) => (email) => {
      if (!email) return null
      return state.members.find(m => m.id.toLowerCase() === email.toLowerCase())
    },
    
    // FIXED: Filter by MembershipType = 'Applicant' (case-insensitive)
    applicants: (state) => {
      return state.members.filter(m => 
        m.MembershipType?.toLowerCase() === 'applicant'
      )
    },
    
    // Filter for Voting Members (Regular or Lifetime)
    votingMembers: (state) => {
      return state.members.filter(m => 
        ['Regular', 'Lifetime'].includes(m.MembershipType) && 
        m.Role !== 'inactive'
      )
    }
  },

  actions: {
    async initMembers() {
      if (this.members.length > 0) return 
      this.loading = true
      onSnapshot(collection(db, 'members'), (snapshot) => {
        this.members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        this.loading = false
      })
    },

    async addMember(data) {
      if (!data.Email) throw new Error("Email is required.")
      const emailId = data.Email.trim().toLowerCase()
      const docRef = doc(db, 'members', emailId)

      const existing = await getDoc(docRef)
      if (existing.exists()) throw new Error(`Member ${data.Email} already exists.`)

      await setDoc(docRef, {
        ...data,
        Email: emailId,
        createdAt: new Date(),
        Role: data.Role || 'member'
      })
    },

    async updateMember(emailId, data) {
      const docRef = doc(db, 'members', emailId)
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      })
    },
}})