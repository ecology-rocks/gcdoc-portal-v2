import { defineStore } from 'pinia'
import { auth, db } from '@/firebase'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'

const KIOSK_EMAIL = 'kiosk@gcdoc.com'
const SUPER_ADMIN_EMAIL = 'reallyjustsam@gmail.com'

const normalizeEmailInput = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return ''
  }
  return normalized
}

const isPermissionDeniedError = (error) => {
  return error?.code === 'permission-denied'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null, 
    profile: null,
    loading: true,
    authError: null,
    initPromise: null,
    authUnsubscribe: null
  }),

  getters: {
    isKioskUser(state) {
      return state.user?.email?.toLowerCase() === KIOSK_EMAIL
    },

    // Cleaner Check: We can now assume 'roles' exists because fetchProfile ensures it.
    hasRole: (state) => (roleName) => {
      if (!state.profile?.roles) return false
      // Check normalized lowercase roles
      return state.profile.roles.includes(roleName.toLowerCase())
    },

    isAdmin() {
      // Keep the super-admin override for safety
      const isSuperUser = this.user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL
      return isSuperUser || this.hasRole('admin')
    }
  },

  actions: {
    async findMemberByEmail(email, uid = '') {
      const originalEmail = String(email || '').trim()
      const normalizedEmail = normalizeEmailInput(email)
      if (!normalizedEmail) return null

      const docRef = doc(db, 'members', normalizedEmail)
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        return { data: snap.data(), ref: docRef }
      }

      const fallbackQ = query(collection(db, 'members'), where('Email', '==', normalizedEmail))
      const fallbackSnap = await getDocs(fallbackQ)
      if (!fallbackSnap.empty) {
        return { data: fallbackSnap.docs[0].data(), ref: fallbackSnap.docs[0].ref }
      }

      if (originalEmail && originalEmail !== normalizedEmail) {
        const originalCaseQ = query(collection(db, 'members'), where('Email', '==', originalEmail))
        const originalCaseSnap = await getDocs(originalCaseQ)
        if (!originalCaseSnap.empty) {
          return { data: originalCaseSnap.docs[0].data(), ref: originalCaseSnap.docs[0].ref }
        }
      }

      if (uid) {
        const byUidQ = query(collection(db, 'members'), where('authUid', '==', String(uid)))
        const byUidSnap = await getDocs(byUidQ)
        if (!byUidSnap.empty) {
          return { data: byUidSnap.docs[0].data(), ref: byUidSnap.docs[0].ref }
        }
      }

      // Last-resort fallback for legacy data inconsistencies.
      const allSnap = await getDocs(collection(db, 'members'))
      const byEmailLoose = allSnap.docs.find((memberDoc) => {
        return normalizeEmailInput(memberDoc.data()?.Email) === normalizedEmail
      })
      if (byEmailLoose) {
        return { data: byEmailLoose.data(), ref: byEmailLoose.ref }
      }

      return null
    },

    async init() {
      if (this.initPromise) return this.initPromise

      this.loading = true
      this.initPromise = new Promise((resolve) => {
        this.authUnsubscribe = onAuthStateChanged(auth, (u) => {
          this.user = u
          this.profile = null

          if (u?.email) {
            // Do not block route resolution on profile hydration.
            this.fetchProfile(u.email, u.uid).catch((e) => {
              this.authError = e?.message || 'Unable to load profile.'
              this.profile = { roles: ['guest'], Email: normalizeEmailInput(u?.email || '') }
            })
          } else if (u) {
            this.profile = { roles: ['guest'] }
          }

          if (this.loading) {
            this.loading = false
            resolve()
          }
        })
      })

      return this.initPromise
    },

    async ensureProfileLoaded() {
      if (!this.user?.email) return

      const hasReadableName = () => Boolean(this.profile?.FirstName || this.profile?.LastName)

      if (hasReadableName()) return

      await this.fetchProfile(this.user.email, this.user.uid)
    },

    async fetchProfile(email, uid = '') {
      if (!email) {
        this.profile = { roles: ['guest'] }
        return
      }
      try {
        const memberMatch = await this.findMemberByEmail(email, uid)

        if (memberMatch) {
          const docRef = memberMatch.ref
          let data = memberMatch.data

          // --- LAZY MIGRATION: Convert Legacy 'Role' to 'roles' Array ---
          // If we see the old 'Role' string but no 'roles' array, fix it in the DB immediately.
          if (!data.roles && data.Role) {
            const legacyRole = data.Role.toLowerCase() // Normalize to lowercase
            const newRoles = [legacyRole]

            // 1. Try to update Firestore (may be blocked by rules for non-admin users)
            try {
              await updateDoc(docRef, { roles: newRoles })
            } catch (migrationError) {
              if (!isPermissionDeniedError(migrationError)) {
                throw migrationError
              }
            }

            // 2. Update the local object so the rest of the app sees the array
            data.roles = newRoles
          }
          // Fallback: Ensure empty array if no roles exist at all
          else if (!data.roles) {
            data.roles = []
          }

          this.profile = data
        } else {
          // Genuine non-member
          this.profile = {
            roles: ['guest'],
            Email: normalizeEmailInput(email)
          }
        }
      } catch (e) {
        if (isPermissionDeniedError(e)) {
          // Avoid hard failure when security rules block profile reads.
          this.profile = {
            roles: ['guest'],
            Email: normalizeEmailInput(email)
          }
          return
        }
        throw e
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

    async logout() {
      await signOut(auth)
      this.user = null
      this.profile = null
    }
  }
})