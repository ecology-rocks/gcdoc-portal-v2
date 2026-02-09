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
            <input 
              v-model="form.Email" 
              type="email" 
              required 
              :class="{ 'disabled-input': isEditMode }" 
              :disabled="isEditMode"
              placeholder="Used for login & lookup"
            >
            <p v-if="isEditMode" class="help-text">Email cannot be changed as it serves as the Member ID.</p>
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
               <option value="Household">Household</option>
               <option value="Associate">Associate</option>
               <option value="Applicant">Applicant</option>
               <option value="Inactive">Inactive</option>
               <option value="Nonmember">Nonmember</option>
            </select>
          </div>
          <div class="form-group">
            <label>Role (Permissions)</label>
            <select v-model="form.Role">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-group">
            <label>Joined Year</label>
            <input v-model="form.Joined" type="number">
          </div>
          <div class="form-group">
            <label>Breeds</label>
            <input v-model="form.Breeds" type="text">
          </div>
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

    <DogManager 
      v-if="isEditMode" 
      :owner-email="form.Email" 
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMembersStore } from '@/stores/membersStore'
import DogManager from './components/DogManager.vue'

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
  MembershipType: 'Applicant', Role: 'member',
  Joined: new Date().getFullYear(), Breeds: ''
})

onMounted(async () => {
  if (isEditMode.value) {
    fetching.value = true
    if (store.members.length === 0) await store.initMembers()
    
    const member = store.getMemberByEmail(route.params.id)
    if (member) {
      form.value = { ...form.value, ...member }
    } else {
      alert('Member not found')
      router.push('/members')
    }
    fetching.value = false
  }
})

const handleSubmit = async () => {
  submitting.value = true
  try {
    if (isEditMode.value) {
      await store.updateMember(route.params.id, form.value)
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