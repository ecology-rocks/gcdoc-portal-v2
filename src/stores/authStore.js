import { defineStore } from 'pinia'
import { auth, db } from '@/firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null, // The Firebase Auth User
    profile: null, // The Firestore Member Data
    loading: true,
    authError: null
  }),

  actions: {
    async init() {
      return new Promise((resolve) => {
        onAuthStateChanged(auth, async (u) => {
          this.user = u
          if (u) {
            // Fetch the linked member profile
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
      // Our CSV importer set the Doc ID to lowercase email
      const docRef = doc(db, 'members', email.toLowerCase())
      const snap = await getDoc(docRef)
      
      if (snap.exists()) {
        this.profile = snap.data()
        // ADMIN CHECK: You can hardcode your email here for now
        this.profile.isAdmin = (email.toLowerCase() === 'reallyjustsam@gmail.com') // Replace with your actual admin email
      } else {
        // Handle "Unknown User" (Registered but not in member list)
        this.profile = { role: 'guest' }
      }
    },

    async login(email, password) {
      this.authError = null
      try {
        await signInWithEmailAndPassword(auth, email, password)
        // router push handled in component
      } catch (e) {
        this.authError = e.message
        throw e
      }
    },

    async register(email, password) {
      this.authError = null
      // 1. Check if member exists first (Optional, but cleaner)
      const docRef = doc(db, 'members', email.toLowerCase())
      const snap = await getDoc(docRef)
      
      if (!snap.exists()) {
        throw new Error("Email not found in member roster. Please contact admin.")
      }

      // 2. Create Auth User
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        
        // 3. CLAIM THE PROFILE: Save the UID to the member doc
        await updateDoc(docRef, {
          authUid: cred.user.uid,
          emailVerified: true // Assumption since we matched the roster
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