<template>
  <div class="max-w-4xl mx-auto py-8 px-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">
        {{ isEditMode ? 'Edit Member' : 'Add New Member' }}
      </h1>
      <button @click="$router.back()" class="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
    </div>

    <div v-if="fetching" class="text-center py-12 text-gray-500">Loading member details...</div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6 bg-white shadow rounded-lg p-6 border border-gray-200 mb-8">
      
      <div>
        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 border-b pb-1">Primary Member</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">First Name</label>
            <input v-model="form.FirstName" type="text" required class="input">
          </div>
          <div>
            <label class="label">Last Name</label>
            <input v-model="form.LastName" type="text" required class="input">
          </div>
          <div class="md:col-span-2">
            <label class="label">Email Address (ID)</label>
            <input 
              v-model="form.Email" 
              type="email" 
              required 
              class="input" 
              :class="isEditMode ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-indigo-50'" 
              :disabled="isEditMode"
              placeholder="Used for login & lookup"
            >
            <p v-if="isEditMode" class="text-xs text-gray-400 mt-1">Email cannot be changed as it serves as the Member ID.</p>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 border-b pb-1">Joint Member</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">First Name (2)</label>
            <input v-model="form.FirstName2" type="text" class="input">
          </div>
          <div>
            <label class="label">Last Name (2)</label>
            <input v-model="form.LastName2" type="text" class="input">
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 border-b pb-1">Contact Numbers</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="label">Phone 1</label>
            <input v-model="form.Phone1" type="text" class="input" placeholder="(555) 123-4567">
            <select v-model="form.Phone1Type" class="input mt-1 text-xs">
              <option value="Cell">Cell</option>
              <option value="Home">Home</option>
              <option value="Work">Work</option>
            </select>
          </div>
           <div>
            <label class="label">Phone 2</label>
            <input v-model="form.Phone2" type="text" class="input">
            <select v-model="form.PhoneType2" class="input mt-1 text-xs">
              <option value="Cell">Cell</option>
              <option value="Home">Home</option>
              <option value="Work">Work</option>
            </select>
          </div>
           <div>
            <label class="label">Phone 3</label>
            <input v-model="form.Phone3" type="text" class="input">
            <select v-model="form.PhoneType3" class="input mt-1 text-xs">
              <option value="Cell">Cell</option>
              <option value="Home">Home</option>
              <option value="Work">Work</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 border-b pb-1">Address</h3>
        <div class="grid grid-cols-6 gap-4">
          <div class="col-span-6">
            <label class="label">Street Address</label>
            <input v-model="form.Address" type="text" class="input">
          </div>
          <div class="col-span-3">
            <label class="label">City</label>
            <input v-model="form.City" type="text" class="input">
          </div>
          <div class="col-span-1">
            <label class="label">State</label>
            <input v-model="form.State" type="text" class="input uppercase" maxlength="2">
          </div>
          <div class="col-span-2">
            <label class="label">Zip</label>
            <input v-model="form.Zip" type="text" class="input">
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 border-b pb-1">Membership Details</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">Type</label>
            <select v-model="form.MembershipType" class="input">
               <option value="Regular">Regular</option>
               <option value="Lifetime">Lifetime</option>
               <option value="Household">Household</option>
               <option value="Associate">Associate</option>
               <option value="Applicant">Applicant</option>
               <option value="Inactive">Inactive</option>
               <option value="Nonmember">Nonmember</option>
            </select>
          </div>
          <div>
            <label class="label">Role (Permissions)</label>
            <select v-model="form.Role" class="input">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label class="label">Joined Year</label>
            <input v-model="form.Joined" type="number" class="input">
          </div>
          <div>
            <label class="label">Breeds</label>
            <input v-model="form.Breeds" type="text" class="input">
          </div>
        </div>
      </div>

      <div class="pt-4 border-t flex justify-end gap-3">
        <button type="button" @click="$router.back()" class="px-4 py-2 text-gray-600 font-bold hover:text-gray-900">Cancel</button>
        <button 
          type="submit" 
          :disabled="submitting"
          class="bg-indigo-600 text-white px-6 py-2 rounded-md font-bold hover:bg-indigo-700 disabled:opacity-50 transition"
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
import DogManager from './components/DogManager.vue' // [NEW IMPORT]

const router = useRouter()
const route = useRoute()
const store = useMembersStore()

const submitting = ref(false)
const fetching = ref(false)
const isEditMode = computed(() => !!route.params.id)

// Original Complex Form Data
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
.label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
}

.input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}
.input:focus {
  border-color: #6366f1;
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}
</style>