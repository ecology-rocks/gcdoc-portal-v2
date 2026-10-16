<template>
  <div class="form-container">
    <div class="form-header">
      <h1>{{ isEditMode ? 'Edit Member' : 'Add New Member' }}</h1>
      <button @click="$router.back()" class="btn-cancel-link">Cancel</button>
    </div>

    <div v-if="fetching" class="loading-state">Loading member details...</div>

    <form v-else @submit.prevent="handleSubmit" class="main-form">
      
      <div class="form-section">
        <h3>Primary Member</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>First Name</label>
            <input v-model="form.FirstName" type="text" required>
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input v-model="form.LastName" type="text" required>
          </div>
          <div class="form-group col-full">
            <label>Email Address (ID)</label>
            <div class="email-row">
              <input
                v-model="form.Email"
                type="email"
                required
                :class="{ 'disabled-input': isEditMode }"
                :disabled="isEditMode"
                placeholder="Used for login & lookup"
              >
              <button v-if="isEditMode" type="button" class="btn-change-email" :disabled="changingEmail" @click="changeEmail">
                {{ changingEmail ? 'Changing...' : 'Change Email' }}
              </button>
            </div>
            <p v-if="isEditMode" class="help-text">The email is the Member ID. Changing it moves their hour logs, vouchers and history to the new address.</p>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>Joint Member</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>First Name (2)</label>
            <input v-model="form.FirstName2" type="text">
          </div>
          <div class="form-group">
            <label>Last Name (2)</label>
            <input v-model="form.LastName2" type="text">
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>Contact Numbers</h3>
        <div class="form-grid col-3">
          <div class="form-group">
            <label>Phone 1</label>
            <input v-model="form.Phone1" type="text" placeholder="(555) 123-4567">
            <select v-model="form.Phone1Type" class="select-sm">
              <option value="Cell">Cell</option>
              <option value="Home">Home</option>
              <option value="Work">Work</option>
            </select>
          </div>
           <div class="form-group">
            <label>Phone 2</label>
            <input v-model="form.Phone2" type="text">
            <select v-model="form.PhoneType2" class="select-sm">
              <option value="Cell">Cell</option>
              <option value="Home">Home</option>
              <option value="Work">Work</option>
            </select>
          </div>
           <div class="form-group">
            <label>Phone 3</label>
            <input v-model="form.Phone3" type="text">
            <select v-model="form.PhoneType3" class="select-sm">
              <option value="Cell">Cell</option>
              <option value="Home">Home</option>
              <option value="Work">Work</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>Address</h3>
        <div class="form-grid address-grid">
          <div class="form-group col-street">
            <label>Street Address</label>
            <input v-model="form.Address" type="text">
          </div>
          <div class="form-group col-city">
            <label>City</label>
            <input v-model="form.City" type="text">
          </div>
          <div class="form-group col-state">
            <label>State</label>
            <input v-model="form.State" type="text" maxlength="2" class="uppercase">
          </div>
          <div class="form-group col-zip">
            <label>Zip</label>
            <input v-model="form.Zip" type="text">
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>Membership Details</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Type</label>
            <select v-model="form.MembershipType">
               <option value="Regular">Regular</option>
               <option value="Lifetime">Lifetime</option>
               <option value="Family">Family</option>
               <option value="Associate">Associate</option>
               <option value="Applicant">Applicant</option>
               <option value="Inactive">Inactive</option>
               <option value="Nonmember">Nonmember</option>
            </select>
          </div>
          <div v-if="statusChanged" class="form-group">
            <label>Reason for type change (optional)</label>
            <input v-model="statusNote" type="text" placeholder="e.g. Voted in at Oct meeting">
            <p class="help-text">Saved to this member's History.</p>
          </div>
          <div class="form-group">
            <label>Joined Year</label>
            <input v-model="form.Joined" type="number">
          </div>
          <div class="form-group">
            <label>Voted In Date</label>
            <input v-model="form.VotedInDate" type="date">
            <p class="help-text">If voted in after July 1, dues are automatically waived for the dues cycle that starts the following Oct 1. Leave blank if unknown.</p>
          </div>
          <div class="form-group">
            <label>Breeds</label>
            <input v-model="form.Breeds" type="text">
          </div>
        </div>
      </div>

      <!-- Only while they're an applicant; values stay on the record after they're voted in -->
      <div v-if="form.MembershipType === 'Applicant'" class="form-section">
        <h3>Applicant Checklist</h3>
        <div class="checklist">
          <label v-for="item in applicantChecklist" :key="item.field" class="check-item">
            <input v-model="form[item.field]" type="checkbox">
            <span>{{ item.label }}</span>
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" @click="$router.back()" class="btn-cancel">Cancel</button>
        <button 
          type="submit" 
          :disabled="submitting"
          class="btn-save"
        >
          {{ submitting ? 'Saving...' : (isEditMode ? 'Update Member' : 'Create Member') }}
        </button>
      </div>

    </form>

    <MemberChangelog
      v-if="isEditMode && !fetching"
      :member-email="route.params.id"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMembersStore, APPLICANT_CHECKLIST } from '@/stores/membersStore'
import MemberChangelog from './components/MemberChangelog.vue'

const router = useRouter()
const route = useRoute()
const store = useMembersStore()

const submitting = ref(false)
const fetching = ref(false)
const isEditMode = computed(() => !!route.params.id)

const form = ref({
  FirstName: '', LastName: '', Email: '',
  FirstName2: '', LastName2: '',
  Phone1: '', Phone1Type: 'Cell',
  Phone2: '', PhoneType2: 'Home',
  Phone3: '', PhoneType3: 'Work',
  Address: '', City: '', State: 'OH', Zip: '',
  MembershipType: 'Applicant',
  // Only new members default to this year - an edit must never show (and then save) a year
  // the member doesn't actually have on file
  Joined: route.params.id ? '' : new Date().getFullYear(), VotedInDate: '', Breeds: '',
  ApplicantClass1: false, ApplicantClass2: false, ApplicantWelcomeEmailSent: false, ApplicantFeePaid: false,
  ApplicantWaiverSigned: false, ApplicantAccountMade: false
})

const applicantChecklist = APPLICANT_CHECKLIST

// Type as loaded, so we can ask for a reason only when it's actually being changed
const originalType = ref('')
const statusNote = ref('')
const statusChanged = computed(() => isEditMode.value && form.value.MembershipType !== originalType.value)

onMounted(async () => {
  if (isEditMode.value) {
    fetching.value = true
    if (store.members.length === 0) await store.initMembers()
    
    const member = store.getMemberByEmail(route.params.id)
    if (member) {
      form.value = { ...form.value, ...member }
      originalType.value = member.MembershipType || ''
      form.value.Joined = member.Joined ?? ''
      // "Household" was renamed to "Family" - upgrade it on save so the dropdown isn't blank
      if (form.value.MembershipType === 'Household') form.value.MembershipType = 'Family'
    } else {
      alert('Member not found')
      router.push('/members')
    }
    fetching.value = false
  }
})

// Email is the doc ID, so it can't just be edited in place - transfer the member (and their logs,
// vouchers and history) to a new doc, then keep editing under the new ID
const changingEmail = ref(false)
const changeEmail = async () => {
  const oldEmail = route.params.id
  const newEmail = (prompt(`New email address for ${form.value.FirstName} ${form.value.LastName}:`, oldEmail) || '').trim().toLowerCase()
  if (!newEmail || newEmail === oldEmail.toLowerCase()) return
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return alert('That doesn\'t look like a valid email address.')
  if (!confirm(`Change this member's email from "${oldEmail}" to "${newEmail}"?\n\nTheir hour logs, vouchers and history move to the new address. Update the email on their WordPress account to match.`)) return

  changingEmail.value = true
  try {
    const result = await store.transferMemberEmail(oldEmail, newEmail)
    form.value.Email = newEmail
    if (form.value.id) form.value.id = newEmail
    await router.replace(`/members/edit/${newEmail}`)
    alert(`Email changed. ${result.logsUpdated} log(s) and ${result.vouchersUpdated} voucher(s) moved to the new address.`)
  } catch (e) {
    alert(e.message)
  } finally {
    changingEmail.value = false
  }
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    if (isEditMode.value) {
      await store.updateMember(route.params.id, form.value, { statusNote: statusNote.value })
      alert('Member updated successfully')
    } else {
      await store.addMember(form.value)
      alert('Member created successfully')
    }
    router.push('/members')
  } catch (e) {
    alert(e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-container {
  max-width: 900px;
  margin: 2rem auto;
  padding: 0 1rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.form-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.btn-cancel-link {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.875rem;
}
.btn-cancel-link:hover { color: #1f2937; }

.loading-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

/* Form Styles */
.main-form {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.form-section {
  margin-bottom: 2rem;
}

.form-section h3 {
  font-size: 0.875rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

/* Grids */
.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
}

.form-group input, .form-group select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  width: 100%;
  box-sizing: border-box;
}

.form-group input:focus, .form-group select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.checklist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.6rem;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.check-item input { width: 1.1rem; height: 1.1rem; cursor: pointer; }

.select-sm {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  padding: 0.25rem;
}

.disabled-input {
  background-color: #f3f4f6;
  color: #6b7280;
  cursor: not-allowed;
}

.email-row {
  display: flex;
  gap: 0.5rem;
}

.btn-change-email {
  flex-shrink: 0;
  background: white;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
  border-radius: 0.375rem;
  padding: 0 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-change-email:hover { background: #eef2ff; }
.btn-change-email:disabled { opacity: 0.5; cursor: not-allowed; }

.help-text {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.uppercase { text-transform: uppercase; }

/* Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}

.btn-cancel {
  background: none;
  border: none;
  color: #4b5563;
  font-weight: 700;
  cursor: pointer;
  padding: 0.5rem 1rem;
}
.btn-cancel:hover { color: #1f2937; }

.btn-save {
  background-color: #4f46e5;
  color: white;
  padding: 0.5rem 1.5rem;
  border-radius: 0.375rem;
  border: none;
  font-weight: 700;
  cursor: pointer;
}
.btn-save:hover { background-color: #4338ca; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

/* Desktop Breakpoints */
@media (min-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .col-full { grid-column: span 2; }
  
  .col-3 {
    grid-template-columns: repeat(3, 1fr);
  }
  
  /* Address Grid Specifics */
  .address-grid {
    grid-template-columns: 6fr 3fr 1fr 2fr;
  }
  .col-street { grid-column: span 4; }
  .col-city { grid-column: span 2; }
  .col-state { grid-column: span 1; }
  .col-zip { grid-column: span 1; }
}
</style>