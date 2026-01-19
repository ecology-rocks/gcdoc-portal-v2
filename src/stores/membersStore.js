import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, onSnapshot } from 'firebase/firestore'

export const useMembersStore = defineStore('members', {
  state: () => ({
    members: [],
    loading: false
  }),

  getters: {
    // Helpers to make the UI cleaner
    getMemberByEmail: (state) => (email) => {
      return state.members.find(m => m.Email?.toLowerCase() === email?.toLowerCase())
    },

    // For the Board Meeting: Applicants only
    applicants: (state) => {
      return state.members
        .filter(m => m.MembershipType === 'Applicant')
        .sort((a, b) => a.LastName.localeCompare(b.LastName))
    },

    // For the Sign-In Sheet: Active Members (excluding applicants)
    activeMembers: (state) => {
      return state.members
        .filter(m => m.isActive === true && m.MembershipType !== 'Applicant')
        .sort((a, b) => a.LastName.localeCompare(b.LastName))
    }
  },

  actions: {
    initMembers() {
      this.loading = true
      onSnapshot(collection(db, 'members'), (snapshot) => {
        this.members = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        this.loading = false
      })
    }
  }
})