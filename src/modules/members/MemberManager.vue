<template>
    <div class="manager-layout">
        <div class="manager-header">
            <div>
                <h1>Member Directory</h1>
                <p class="subtitle">{{ filteredMembers.length }} active records found</p>
            </div>
            <div class="actions-wrapper">
                <div class="actions">
                    <input 
                      v-model="search" 
                      type="text" 
                      placeholder="Search members..."
                      class="search-input"
                    >
                    <select v-model="selectedType" class="filter-select">
                        <option value="">All Types</option>
                        <option v-for="type in uniqueTypes" :key="type" :value="type">{{ type }}</option>
                    </select>
                    <button @click="$router.push('/members/add')" class="btn-add">
                        <span>+</span> Add Member
                    </button>
                </div>
            </div>
        </div>

        <div class="members-grid">
            <div v-for="m in filteredMembers" :key="m.id" class="member-card">
                <div class="card-header">
                    <div>
                        <div class="primary-text">{{ m.LastName }}, {{ m.FirstName }}</div>
                        <div v-if="m.FirstName2" class="secondary-text">
                          & {{ m.FirstName2 }} {{ m.LastName2 }}
                        </div>
                    </div>
                    <span class="badge badge-blue">{{ m.MembershipType }}</span>
                </div>
                
                <div class="card-body">
                    <button @click="copyEmail(m.Email)" class="btn-copy" :title="'Copy ' + m.Email">
                        <span class="email-text">{{ m.Email }}</span>
                        <span class="copy-icon">{{ copiedEmail === m.Email ? 'Copied!' : '📋' }}</span>
                    </button>
                    <div class="secondary-text">{{ m.Phone1 }}</div>
                    <div class="hours-text">FY Hours: <strong>{{ getFYHours(m.Email) }}</strong></div>
                </div>

                <div class="card-footer">
                    <button @click="$router.push(`/members/edit/${m.Email}`)" class="btn-link">
                        Edit Member
                    </button>
                </div>
            </div>
            
            <div v-if="filteredMembers.length === 0" class="empty-state">
                No members found matching your search or filter.
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'

const store = useMembersStore()
const logsStore = useLogsStore()
const search = ref('')
const selectedType = ref('')
const copiedEmail = ref(null)

onMounted(async () => {
    await Promise.all([
        store.initMembers(),
        logsStore.initLogs()
    ])
})

const uniqueTypes = computed(() => {
    const types = store.members.map(m => m.MembershipType).filter(Boolean)
    return [...new Set(types)].sort()
})

/* Replace the filteredMembers computed property */
const filteredMembers = computed(() => {
    let list = store.members
    
    if (selectedType.value) {
        list = list.filter(m => m.MembershipType === selectedType.value)
    }
    
    if (search.value) {
        const q = search.value.toLowerCase()
        list = list.filter(m =>
            m.LastName?.toLowerCase().includes(q) ||
            m.FirstName?.toLowerCase().includes(q) ||
            m.Email?.toLowerCase().includes(q)
        )
    }
    
    return list.sort((a, b) => {
        const nameA = (a.LastName || '').toLowerCase()
        const nameB = (b.LastName || '').toLowerCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
    })
})

const getFYHours = (email) => {
    if (!email) return 0
    const hrs = logsStore.fiscalYearHours[email.toLowerCase()] || 0
    return Math.round(hrs * 100) / 100
}

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
.manager-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}
.manager-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .manager-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

.actions-wrapper {
  width: 100%;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

@media (min-width: 768px) {
  .actions-wrapper { width: auto; }
  .actions {
    flex-direction: row;
    align-items: center;
  }
}

.filter-select, .search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  width: 100%;
  box-sizing: border-box;
  background-color: white;
}

@media (min-width: 768px) {
  .filter-select, .search-input { width: auto; }
}

.btn-add {
  background-color: #4f46e5;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.btn-add:hover { background-color: #4338ca; }

/* Grid / Card Layout */
.members-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  overflow-y: auto;
  flex: 1;
  padding-bottom: 1rem;
}

@media (min-width: 640px) {
  .members-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .members-grid { grid-template-columns: repeat(3, 1fr); }
}

.member-card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.card-body {
  margin-bottom: 1rem;
  flex: 1;
}

.card-footer {
  border-top: 1px solid #f3f4f6;
  padding-top: 0.75rem;
  text-align: right;
}

.primary-text {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
}

.secondary-text {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.badge {
  display: inline-flex;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.badge-blue {
  background-color: #dbeafe;
  color: #1e40af;
}

.btn-link {
  background: none;
  border: none;
  color: #4f46e5;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-link:hover {
  color: #312e81;
}

.btn-copy {
  background: none;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: #4f46e5;
  font-size: 0.875rem;
  font-weight: 500;
}
.btn-copy:hover { color: #312e81; }

.copy-icon {
  font-size: 0.75rem;
  background-color: #f3f4f6;
  color: #374151;
  padding: 2px 6px;
  border-radius: 4px;
}

.email-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px; /* Adjust based on your preference */
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