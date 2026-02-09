<template>
    <div class="manager-layout">
        <div class="manager-header">
            <div>
                <h1>Member Directory</h1>
                <p class="subtitle">{{ filteredMembers.length }} active records found</p>
            </div>
            <div class="actions">
                <input 
                  v-model="search" 
                  type="text" 
                  placeholder="Search members..."
                  class="search-input"
                >
                <button @click="$router.push('/members/add')" class="btn-add">
                    <span>+</span> Add Member
                </button>
            </div>
        </div>

        <div class="table-card">
            <div class="table-container">
                <table class="member-table">
                    <thead>
                        <tr>
                            <th>Member</th>
                            <th>Contact</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="m in filteredMembers" :key="m.id">
                            <td>
                                <div class="primary-text">{{ m.LastName }}, {{ m.FirstName }}</div>
                                <div v-if="m.FirstName2" class="secondary-text">
                                  & {{ m.FirstName2 }} {{ m.LastName2 }}
                                </div>
                            </td>
                            <td>
                                <div class="primary-text">{{ m.Email }}</div>
                                <div class="secondary-text">{{ m.Phone1 }}</div>
                            </td>
                            <td>
                                <span class="badge badge-blue">
                                    {{ m.MembershipType }}
                                </span>
                            </td>
                            <td>
                                <span class="status-text">{{ m.Role }}</span>
                            </td>
                            <td class="text-right">
                                <button 
                                  @click="$router.push(`/members/edit/${m.Email}`)"
                                  class="btn-link"
                                >
                                    Edit
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMembersStore } from '@/stores/membersStore'

const store = useMembersStore()
const search = ref('')

onMounted(() => {
    store.initMembers()
})

const filteredMembers = computed(() => {
    if (!search.value) return store.members
    const q = search.value.toLowerCase()
    return store.members.filter(m =>
        m.LastName?.toLowerCase().includes(q) ||
        m.FirstName?.toLowerCase().includes(q) ||
        m.Email?.toLowerCase().includes(q)
    )
})
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.manager-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
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
  gap: 0.5rem;
}
.btn-add:hover { background-color: #4338ca; }

/* Table Styles */
.table-card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.table-container {
  overflow-y: auto;
  flex: 1;
}

.member-table {
  width: 100%;
  border-collapse: collapse;
}

.member-table th {
  background-color: #f9fafb;
  position: sticky;
  top: 0;
  padding: 0.75rem 1.5rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
}

.member-table td {
  padding: 1rem 1.5rem;
  white-space: nowrap;
  border-bottom: 1px solid #e5e7eb;
}

.member-table tr:hover {
  background-color: #f9fafb;
}

.primary-text {
  font-size: 0.875rem;
  font-weight: 700;
  color: #111827;
}

.secondary-text {
  font-size: 0.75rem;
  color: #6b7280;
}

.status-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
}

.badge {
  display: inline-flex;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25;
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

.text-right { text-align: right; }
</style>