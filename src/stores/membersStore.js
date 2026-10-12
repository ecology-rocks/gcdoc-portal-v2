import { defineStore } from 'pinia'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/authStore'
import { collection, onSnapshot, doc, setDoc, getDoc, deleteDoc, writeBatch, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore'

const normalizeEmail = (value) => (value || '').trim().toLowerCase()

// The dues cycle tracked by the Dues2026Paid / Dues2026PaidAt fields
const DUES_YEAR = 2026

// Applicant progress checkboxes, stored as booleans on the member doc. `short` is the printable's
// column header.
export const APPLICANT_CHECKLIST = [
  { field: 'ApplicantClass1', label: 'Class 1', short: 'Class 1' },
  { field: 'ApplicantClass2', label: 'Class 2', short: 'Class 2' },
  { field: 'ApplicantWelcomeEmailSent', label: 'Welcome Email Sent', short: 'Welcome Email' },
  { field: 'ApplicantFeePaid', label: 'Paid Fee', short: 'Fee' },
  { field: 'ApplicantWaiverSigned', label: 'Waiver Signed', short: 'Waiver' }
]

// Members can't vote until their dues are paid; Lifetime members always can
export const isEligibleToVote = (m) =>
  (m.MembershipType || '').toLowerCase() === 'lifetime' || Boolean(m.Dues2026Paid)

// --- Member changelog ---
// Append-only history at members/{email}/changelog/{id}. The member doc stays the single source of
// "current state"; these entries only record what changed and when. Event types:
//   status_change          { from, to, note }
//   dues_payment           { duesYear }
//   dues_payment_reversed  { duesYear }
//   email_change           { from, to }
//   applicant_step         { field, label, done }
//   note                   { text }
const changelogCollection = (memberId) => collection(db, 'members', memberId, 'changelog')

const newChangelogEntry = (type, fields = {}) => ({
  date: Timestamp.now(),
  type,
  by: useAuthStore().user?.email || '',
  ...fields
})

// Queue a changelog entry in an existing batch, so it commits together with the member update
const addChangelogToBatch = (batch, memberId, type, fields) => {
  batch.set(doc(changelogCollection(memberId)), newChangelogEntry(type, fields))
}

// "Household" was renamed to "Family"
const normalizeMembershipType = (value) => {
  const type = (value || '').trim()
  return type.toLowerCase() === 'household' ? 'Family' : type
}

export const useMembersStore = defineStore('members', {
  state: () => ({
    members: [],
    loading: false,
    error: null,
    unsubscribeMembers: null
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
        ['Regular', 'Lifetime', 'Family'].includes(m.MembershipType)
      )
    },

    // Voting members who can actually vote: dues paid, or Lifetime (who never owe dues)
    eligibleVoters() {
      return this.votingMembers.filter(m => isEligibleToVote(m))
    },

    // 20% of eligible voters, rounded up
    quorum() {
      return Math.ceil(this.eligibleVoters.length * 0.2)
    }
  },

  actions: {
    async initMembers() {
      if (this.unsubscribeMembers || this.members.length > 0) return

      const authStore = useAuthStore()
      if (authStore.loading) await authStore.init()

      if (!authStore.user) {
        this.loading = false
        this.members = []
        this.error = 'Sign in required to view members.'
        return
      }

      this.loading = true
      this.error = null
      this.unsubscribeMembers = onSnapshot(
        collection(db, 'members'),
        (snapshot) => {
          this.members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          this.loading = false
        },
        (error) => {
          this.loading = false
          this.error = error?.code === 'permission-denied'
            ? 'You do not have permission to read members.'
            : error?.message || 'Unable to load members.'
          if (error?.code === 'permission-denied') {
            this.members = []
          }
        }
      )
    },

    stopMembersListener() {
      if (this.unsubscribeMembers) {
        this.unsubscribeMembers()
        this.unsubscribeMembers = null
      }
    },

    async addMember(data) {
      if (!data.Email) throw new Error("Email is required.")
      const emailId = normalizeEmail(data.Email)
      const docRef = doc(db, 'members', emailId)

      const existing = await getDoc(docRef)
      if (existing.exists()) throw new Error(`Member ${data.Email} already exists.`)

      const batch = writeBatch(db)
      batch.set(docRef, {
        ...data,
        Email: emailId,
        createdAt: new Date()
      })
      addChangelogToBatch(batch, emailId, 'status_change', { from: '', to: data.MembershipType || '', note: 'Member added' })
      APPLICANT_CHECKLIST.filter(item => data[item.field]).forEach(item => {
        addChangelogToBatch(batch, emailId, 'applicant_step', { field: item.field, label: item.label, done: true })
      })
      await batch.commit()
    },

    async setDuesPaid(emailId, paid) {
      const existingMember = this.getMemberByEmail(emailId)
      const resolvedDocId = normalizeEmail(existingMember?.id || emailId)
      const docRef = doc(db, 'members', resolvedDocId)

      const batch = writeBatch(db)
      batch.update(docRef, {
        Dues2026Paid: paid,
        Dues2026PaidAt: paid ? Timestamp.now() : null
      })
      addChangelogToBatch(batch, resolvedDocId, paid ? 'dues_payment' : 'dues_payment_reversed', { duesYear: DUES_YEAR })
      await batch.commit()
    },

    // One-tap toggle of a single applicant checklist box (Members page), with its history entry
    async setApplicantStep(emailId, field, done) {
      const item = APPLICANT_CHECKLIST.find(i => i.field === field)
      if (!item) throw new Error(`Unknown applicant step: ${field}`)

      const existingMember = this.getMemberByEmail(emailId)
      const resolvedDocId = normalizeEmail(existingMember?.id || emailId)

      const batch = writeBatch(db)
      batch.update(doc(db, 'members', resolvedDocId), { [field]: done, updatedAt: new Date() })
      addChangelogToBatch(batch, resolvedDocId, 'applicant_step', { field, label: item.label, done })
      await batch.commit()
    },

    // statusNote: optional reason recorded in the changelog when MembershipType changes
    async updateMember(emailId, data, { statusNote = '' } = {}) {
      const existingMember = this.getMemberByEmail(emailId)
      const resolvedDocId = normalizeEmail(existingMember?.id || emailId)
      const resolvedEmail = normalizeEmail(data.Email || existingMember?.Email || emailId)
      const docRef = doc(db, 'members', resolvedDocId)

      // Read the stored doc (not the cached list) so the "before" values are accurate
      const before = await getDoc(docRef)
      const beforeData = before.exists() ? before.data() : {}
      const previousType = beforeData.MembershipType || ''

      const batch = writeBatch(db)
      batch.update(docRef, {
        ...data,
        Email: resolvedEmail,
        updatedAt: new Date()
      })
      if (data.MembershipType !== undefined && data.MembershipType !== previousType) {
        addChangelogToBatch(batch, resolvedDocId, 'status_change', { from: previousType, to: data.MembershipType, note: statusNote.trim() })
      }
      APPLICANT_CHECKLIST.forEach(item => {
        if (data[item.field] === undefined) return
        if (Boolean(data[item.field]) !== Boolean(beforeData[item.field])) {
          addChangelogToBatch(batch, resolvedDocId, 'applicant_step', { field: item.field, label: item.label, done: Boolean(data[item.field]) })
        }
      })
      await batch.commit()
    },

    // Newest first
    async fetchChangelog(emailId) {
      const memberId = normalizeEmail(emailId)
      const snap = await getDocs(query(changelogCollection(memberId), orderBy('date', 'desc')))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    },

    async addChangelogNote(emailId, text) {
      const trimmed = (text || '').trim()
      if (!trimmed) throw new Error('Note is empty.')
      await setDoc(doc(changelogCollection(normalizeEmail(emailId))), newChangelogEntry('note', { text: trimmed }))
    },

    // --- NEW: IMPORT/EXPORT ACTIONS ---

    // Each row can write a member doc plus a changelog entry, so callers should keep rows per call
    // at or under 200 to stay within Firestore's 500-operation batch limit.
    async importGenericRows(rows) {
      const batch = writeBatch(db)
      let count = 0

      // Current types, so a type change made by the import is recorded in the changelog
      const existingSnap = await getDocs(collection(db, 'members'))
      const existingTypes = new Map(existingSnap.docs.map(d => [d.id, d.data().MembershipType || '']))

      rows.forEach(row => {
        const email = row['Email']?.trim() || row['email']?.trim()
        const normalizedEmail = normalizeEmail(email)

        if (normalizedEmail) {
          const docRef = doc(db, 'members', normalizedEmail)
          const newType = normalizeMembershipType(row['MembershipType']) || 'Applicant'
          if (!existingTypes.has(normalizedEmail)) {
            addChangelogToBatch(batch, normalizedEmail, 'status_change', { from: '', to: newType, note: 'Added by CSV import' })
          } else if (existingTypes.get(normalizedEmail) !== newType) {
            addChangelogToBatch(batch, normalizedEmail, 'status_change', { from: existingTypes.get(normalizedEmail), to: newType, note: 'Changed by CSV import' })
          }

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
            MembershipType: newType,
            Joined: row['Joined'] || '',
            VotedInDate: row['VotedInDate'] || '',
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

      // Move the changelog to the new member doc (subcollections don't follow a copied doc),
      // then record the email change itself
      const historySnap = await getDocs(changelogCollection(oldNorm))
      const historyDocs = [...historySnap.docs]
      while (historyDocs.length > 0) {
        const historyBatch = writeBatch(db)
        historyDocs.splice(0, 200).forEach(entry => {
          historyBatch.set(doc(changelogCollection(newNorm), entry.id), entry.data())
          historyBatch.delete(entry.ref)
        })
        await historyBatch.commit()
      }
      await setDoc(doc(changelogCollection(newNorm)), newChangelogEntry('email_change', { from: oldNorm, to: newNorm }))

      // Remove old member document
      await deleteDoc(oldDocRef)

      return { logsUpdated: totalLogs }
    },

    async getExportData({ excludeInactive = false } = {}) {
      // Ensure we have the latest data
      const q = query(collection(db, 'members'))
      const snap = await getDocs(q)
      let allMembers = snap.docs.map(d => d.data())
      if (excludeInactive) {
        allMembers = allMembers.filter(m => (m.MembershipType || '').toLowerCase() !== 'inactive')
      }

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
        VotedInDate: m.VotedInDate,
        Breeds: m.Breeds,
        // Export-only (importGenericRows ignores these) - used to build MailPoet reminder lists
        Dues2026Paid: m.Dues2026Paid ? 'Yes' : 'No',
        Dues2026PaidAt: m.Dues2026PaidAt?.toDate ? m.Dues2026PaidAt.toDate().toISOString().split('T')[0] : ''
      }))
    }
  }
})