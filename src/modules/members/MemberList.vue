<template>
  <div class="member-list-container">
    <div class="list-header">
      <h1>Members</h1>
      <span v-if="!loading" class="record-count">{{ members.length }} records found</span>
    </div>

    <div v-if="loading" class="loading-state">Loading members...</div>

    <div v-else class="list-card">
      <ul class="member-items">
        <li v-for="member in members" :key="member.id" class="member-row">
          <div class="row-content">
            <div class="row-top">
              <p class="member-name">{{ member.LastName }}, {{ member.FirstName }}</p>
              <span class="status-badge" :class="member.Status?.toLowerCase()">{{ member.Status }}</span>
            </div>
            <div class="row-bottom">
              <p class="member-email">{{ member.Email }}</p>
              <p class="membership-type">{{ member.MembershipType }}</p>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useMembersStore } from '@/stores/membersStore'

const store = useMembersStore()
const members = computed(() => store.members)
const loading = computed(() => store.loading)

onMounted(() => {
  store.initMembers()
})
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.list-header h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0; }
.record-count { font-size: 0.875rem; color: #6b7280; }

.loading-state { text-align: center; padding: 2.5rem 0; color: #6b7280; }

.list-card {
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-radius: 0.5rem;
  overflow: hidden;
}

.member-items { list-style: none; padding: 0; margin: 0; }

.member-row {
  border-bottom: 1px solid #e5e7eb;
}

.member-row:last-child { border-bottom: none; }

.row-content { padding: 1rem 1.5rem; }
.row-content:hover { background-color: #f9fafb; }

.row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.member-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #2563eb;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background-color: #f3f4f6;
  color: #374151;
}

.status-badge.active { background-color: #dcfce7; color: #166534; }

.row-bottom { display: flex; justify-content: space-between; }
.member-email, .membership-type { font-size: 0.875rem; color: #6b7280; margin: 0; }
</style>