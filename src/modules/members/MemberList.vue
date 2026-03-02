<template>
  <div class="member-list-container">
    <div class="list-header">
      <div class="header-left">
        <h1>Members</h1>
        <span v-if="!loading" class="record-count">{{ filteredMembers.length }} records found</span>
      </div>
      <div class="header-right">
         <select v-model="selectedType" class="filter-select">
            <option value="">All Types</option>
            <option v-for="type in uniqueTypes" :key="type" :value="type">{{ type }}</option>
         </select>
      </div>
    </div>

    <div v-if="loading" class="loading-state">Loading members...</div>

    <div v-else class="members-grid">
      <div v-for="member in filteredMembers" :key="member.id" class="member-card">
        <div class="card-content">
          <h3 class="member-name">{{ member.LastName }}, {{ member.FirstName }}</h3>
          <p class="membership-type">{{ member.MembershipType }}</p>
          
          <div class="card-actions">
            <button @click="copyEmail(member.Email)" class="btn-copy" :title="'Copy ' + member.Email">
              <span class="email-text">{{ member.Email }}</span>
              <span class="copy-icon">{{ copiedEmail === member.Email ? 'Copied!' : '📋' }}</span>
            </button>
          </div>
        </div>
      </div>
      
      <div v-if="filteredMembers.length === 0" class="empty-state">
        No members found for this filter.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useMembersStore } from '@/stores/membersStore'

const store = useMembersStore()
const loading = computed(() => store.loading)
const selectedType = ref('')
const copiedEmail = ref(null)

onMounted(() => {
  store.initMembers()
})

const uniqueTypes = computed(() => {
  const types = store.members.map(m => m.MembershipType).filter(Boolean)
  return [...new Set(types)].sort()
})

const filteredMembers = computed(() => {
  if (!selectedType.value) return store.members
  return store.members.filter(m => m.MembershipType === selectedType.value)
})

const copyEmail = async (email) => {
  if (!email) return
  try {
    await navigator.clipboard.writeText(email)
    copiedEmail.value = email
    setTimeout(() => { copiedEmail.value = null }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}
</script>

<style scoped>
.member-list-container {
  max-width: 1200px;
  margin: 1.5rem auto;
  padding: 0 1rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.list-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 640px) {
  .list-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.header-left h1 { 
  font-size: 1.5rem; 
  font-weight: 700; 
  color: #111827; 
  margin: 0; 
}

.record-count { 
  font-size: 0.875rem; 
  color: #6b7280; 
}

.filter-select {
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 0.5rem;
  font-size: 0.875rem;
  background-color: white;
  width: 100%;
}

@media (min-width: 640px) {
  .filter-select { width: auto; min-width: 200px; }
}

.loading-state { 
  text-align: center; 
  padding: 2.5rem 0; 
  color: #6b7280; 
}

.members-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .members-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .members-grid { grid-template-columns: repeat(3, 1fr); }
}

.member-card {
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.25rem 0;
}

.membership-type {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0 0 1rem 0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-actions {
  margin-top: auto;
  border-top: 1px solid #f3f4f6;
  padding-top: 0.75rem;
}

.btn-copy {
  background: none;
  border: none;
  padding: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  color: #4f46e5;
  font-size: 0.875rem;
}

.btn-copy:hover { color: #312e81; }

.email-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 0.5rem;
}

.copy-icon {
  flex-shrink: 0;
  font-size: 0.75rem;
  background-color: #f3f4f6;
  color: #374151;
  padding: 2px 6px;
  border-radius: 4px;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-style: italic;
  border: 2px dashed #e5e7eb;
  border-radius: 0.5rem;
}
</style>