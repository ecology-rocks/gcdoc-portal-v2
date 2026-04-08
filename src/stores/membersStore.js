import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, writeBatch, getDocs, query, where, Timestamp } from 'firebase/firestore'

const normalizeEmail = (value) => (value || '').trim().toLowerCase()

export const useMembersStore = defineStore('members', {
  state: () => ({
    members: [],
    loading: false
  }),

  getters: {
    getMemberByEmail: (state) => (email) => {
      const normalizedEmail = normalizeEmail(email)
      if (!normalizedEmail) return null

      return state.members.find(m => {
        return normalizeEmail(m.id) === normalizedEmail || normalizeEmail(m.Email) === normalizedEmail
      })
    },
    
    // Filter by MembershipType = 'Applicant' (case-insensitive)
    applicants: (state) => {
      return state.members.filter(m => 
        m.MembershipType?.toLowerCase() === 'applicant'
      )
    },
    
    // Filter for Voting Members (Regular or Lifetime)
    votingMembers: (state) => {
      return state.members.filter(m => 
        ['Regular', 'Lifetime', 'Family'].includes(m.MembershipType) && 
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
      const emailId = normalizeEmail(data.Email)
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
      const existingMember = this.getMemberByEmail(emailId)
      const resolvedDocId = normalizeEmail(existingMember?.id || emailId)
      const resolvedEmail = normalizeEmail(data.Email || existingMember?.Email || emailId)
      const docRef = doc(db, 'members', resolvedDocId)

      await updateDoc(docRef, {
        ...data,
        Email: resolvedEmail,
        updatedAt: new Date()
      })
    },

    // --- NEW: IMPORT/EXPORT ACTIONS ---

    async importGenericRows(rows) {
      const batch = writeBatch(db)
      let count = 0

      rows.forEach(row => {
        const email = row['Email']?.trim() || row['email']?.trim()
        const normalizedEmail = normalizeEmail(email)
        
        if (normalizedEmail) {
          const docRef = doc(db, 'members', normalizedEmail)
          
          // Strict Mapping based on your Schema
          batch.set(docRef, {
            Email: normalizedEmail,
            FirstName: row['FirstName'] || '',
            FirstName2: row['FirstName2'] || '',
            LastName: row['LastName'] || '',
            LastName2: row['LastName2'] || '',
            
            // Address Block
            Address: row['Address'] || '',
            City: row['City'] || '',
            State: row['State'] || '',
            Zip: row['Zip'] || '',
            
            // Phones
            Phone1: row['Phone1'] || '',
            Phone1Type: row['Phone1Type'] || '',
            Phone2: row['Phone2'] || '',
            PhoneType2: row['PhoneType2'] || '',
            Phone3: row['Phone3'] || '',
            PhoneType3: row['PhoneType3'] || '',

            // Club Data
            MembershipType: row['MembershipType'] || 'Applicant',
            Joined: row['Joined'] || '',
            Role: row['Role'] || 'member',
            LegacyKey: row['LegacyKey'] || row['ID'] || '',
            Breeds: row['Breeds'] || '',
            
            updatedAt: Timestamp.now()
          }, { merge: true })
          count++
        }
      })

      await batch.commit()
      return count
    },

    async transferMemberEmail(oldEmail, newEmail) {
      const oldNorm = normalizeEmail(oldEmail)
      const newNorm = normalizeEmail(newEmail)

      if (!oldNorm || !newNorm) throw new Error('Both email addresses are required.')
      if (oldNorm === newNorm) throw new Error('New email must be different from the current email.')

      const oldDocRef = doc(db, 'members', oldNorm)
      const oldSnap = await getDoc(oldDocRef)
      if (!oldSnap.exists()) throw new Error(`No member found with email: ${oldEmail}`)

      const newDocRef = doc(db, 'members', newNorm)
      const newSnap = await getDoc(newDocRef)
      if (newSnap.exists()) throw new Error(`A member already exists at email: ${newEmail}`)

      // Copy member data to new document ID
      const memberData = oldSnap.data()
      await setDoc(newDocRef, { ...memberData, Email: newNorm, updatedAt: new Date() })

      // Batch-update all logs referencing the old email
      const logsSnap = await getDocs(query(collection(db, 'logs'), where('MemberEmail', '==', oldNorm)))
      let logsBatch = writeBatch(db)
      let batchCount = 0
      let totalLogs = 0
      for (const logDoc of logsSnap.docs) {
        logsBatch.update(logDoc.ref, { MemberEmail: newNorm })
        batchCount++
        totalLogs++
        if (batchCount >= 400) {
          await logsBatch.commit()
          logsBatch = writeBatch(db)
          batchCount = 0
        }
      }
      if (batchCount > 0) await logsBatch.commit()

      // Remove old member document
      await deleteDoc(oldDocRef)

      return { logsUpdated: totalLogs }
    },

    async getExportData() {
      // Ensure we have the latest data
      const q = query(collection(db, 'members'))
      const snap = await getDocs(q)
      const allMembers = snap.docs.map(d => d.data())

      // Map to CSV Columns
      return allMembers.map(m => ({
        Email: m.Email,
        FirstName: m.FirstName,
        LastName: m.LastName,
        FirstName2: m.FirstName2,
        LastName2: m.LastName2,
        Address: m.Address,
        City: m.City,
        State: m.State,
        Zip: m.Zip,
        Phone1: m.Phone1,
        Phone1Type: m.Phone1Type,
        Phone2: m.Phone2,
        PhoneType2: m.PhoneType2,
        Phone3: m.Phone3,
        PhoneType3: m.PhoneType3,
        LegacyKey: m.LegacyKey,
        MembershipType: m.MembershipType,
        Joined: m.Joined,
        Role: m.Role,
        Breeds: m.Breeds
      }))
    }
  }
})