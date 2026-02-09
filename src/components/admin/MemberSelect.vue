<template>
  <div class="member-select">
    <input
      type="text"
      v-model="searchQuery"
      @focus="isOpen = true"
      @input="handleInput"
      @blur="closeDelayed"
      placeholder="Type Name (Last, First)..."
      class="select-input"
    />
    
    <div v-if="isOpen && filteredMembers.length > 0" class="dropdown-menu">
      <div
        v-for="member in filteredMembers"
        :key="member.id"
        @mousedown.prevent="selectMember(member)"
        class="dropdown-item"
      >
        <div class="item-content">
          <span class="member-name">
            {{ member.LastName }}, {{ member.FirstName }}
          </span>
          <span class="member-email">
            {{ member.Email }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useMembersStore } from '@/stores/membersStore'

const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])

const store = useMembersStore()
const isOpen = ref(false)
const searchQuery = ref('')

onMounted(() => {
  if (store.members.length === 0) store.initMembers()
})

watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    searchQuery.value = ''
    return
  }
  const found = store.getMemberByEmail(newVal)
  if (found) {
    searchQuery.value = `${found.LastName}, ${found.FirstName}`
  } else {
    searchQuery.value = newVal
  }
}, { immediate: true })

const filteredMembers = computed(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value.toLowerCase()
  
  return store.members
    .filter(m => {
      const full = `${m.LastName}, ${m.FirstName}`.toLowerCase()
      const reverse = `${m.FirstName} ${m.LastName}`.toLowerCase()
      return full.includes(q) || reverse.includes(q) || m.Email?.toLowerCase().includes(q)
    })
    .slice(0, 10)
    .sort((a, b) => a.LastName.localeCompare(b.LastName))
})

const handleInput = () => {
  isOpen.value = true
  if (!searchQuery.value) emit('update:modelValue', '')
}

const selectMember = (member) => {
  searchQuery.value = `${member.LastName}, ${member.FirstName}`
  emit('update:modelValue', member.Email)
  isOpen.value = false
}

const closeDelayed = () => {
  setTimeout(() => isOpen.value = false, 200)
}
</script>

<style scoped>
.member-select {
  position: relative;
  width: 100%;
  font-family: system-ui, -apple-system, sans-serif;
}

.select-input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  box-sizing: border-box;
}

.select-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 1px #6366f1;
}

.dropdown-menu {
  position: absolute;
  z-index: 50;
  margin-top: 0.25rem;
  width: 100%;
  background-color: white;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border-radius: 0.375rem;
  max-height: 15rem;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
}

.dropdown-item {
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  user-select: none;
}

.dropdown-item:hover {
  background-color: #4f46e5;
}

.dropdown-item:hover .member-name,
.dropdown-item:hover .member-email {
  color: white;
}

.item-content {
  display: flex;
  flex-direction: column;
}

.member-name {
  display: block;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-email {
  font-size: 0.75rem;
  color: #6b7280;
}
</style>