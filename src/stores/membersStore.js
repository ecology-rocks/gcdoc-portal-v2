import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { collection, onSnapshot, doc, setDoc, getDoc, updateDoc, writeBatch, getDocs, query, Timestamp } from 'firebase/firestore'

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

    // --- NEW: IMPORT/EXPORT ACTIONS ---

    async importGenericRows(rows) {
      const batch = writeBatch(db)
      let count = 0

      rows.forEach(row => {
        const email = row['Email']?.trim() || row['email']?.trim()
        
        if (email) {
          const docRef = doc(db, 'members', email.toLowerCase())
          
          // Strict Mapping based on your Schema
          batch.set(docRef, {
            Email: email,
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