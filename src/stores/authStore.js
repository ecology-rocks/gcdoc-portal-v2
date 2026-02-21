import { defineStore } from 'pinia'
import { auth, db } from '@/firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null, 
    profile: null,
    loading: true,
    authError: null
  }),

  getters: {
    // Cleaner Check: We can now assume 'roles' exists because fetchProfile ensures it.
    hasRole: (state) => (roleName) => {
      if (!state.profile?.roles) return false
      // Check normalized lowercase roles
      return state.profile.roles.includes(roleName.toLowerCase())
    },

    isAdmin() {
      // Keep the super-admin override for safety
      const isSuperUser = this.user?.email?.toLowerCase() === 'reallyjustsam@gmail.com'
      return isSuperUser || this.hasRole('admin')
    },

    isRegistrar() {
      return this.isAdmin || this.hasRole('registrar')
    }
  },

  actions: {
    async init() {
      return new Promise((resolve) => {
        onAuthStateChanged(auth, async (u) => {
          this.user = u
          if (u) {
            await this.fetchProfile(u.email)
          } else {
            this.profile = null
          }
          this.loading = false
          resolve()
        })
      })
    },

    async fetchProfile(email) {
      if (!email) return
      const docRef = doc(db, 'members', email.toLowerCase())
      const snap = await getDoc(docRef)
      
      if (snap.exists()) {
        let data = snap.data()
        
        // --- LAZY MIGRATION: Convert Legacy 'Role' to 'roles' Array ---
        // If we see the old 'Role' string but no 'roles' array, fix it in the DB immediately.
        if (!data.roles && data.Role) {
          const legacyRole = data.Role.toLowerCase() // Normalize to lowercase
          const newRoles = [legacyRole]

          // 1. Update Firestore
          await updateDoc(docRef, { roles: newRoles })
          
          // 2. Update the local object so the rest of the app sees the array
          data.roles = newRoles
        } 
        // Fallback: Ensure empty array if no roles exist at all
        else if (!data.roles) {
          data.roles = []
        }

        this.profile = data
      } else {
        // Guest / Non-member handling
        this.profile = { roles: ['guest'] }
      }
    },

    async login(email, password) {
      this.authError = null
      try {
        await signInWithEmailAndPassword(auth, email, password)
      } catch (e) {
        this.authError = e.message
        throw e
      }
    },

    async register(email, password) {
      this.authError = null
      const docRef = doc(db, 'members', email.toLowerCase())
      const snap = await getDoc(docRef)
      
      if (!snap.exists()) {
        throw new Error("Email not found in member roster. Please contact admin.")
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateDoc(docRef, {
          authUid: cred.user.uid,
          emailVerified: true 
        })
      } catch (e) {
        this.authError = e.message
        throw e
      }
    },

    async logout() {
      await signOut(auth)
      this.user = null
      this.profile = null
    }
  }
})