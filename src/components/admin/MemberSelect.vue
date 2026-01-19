<template>
  <div class="relative">
    <input
      type="text"
      v-model="searchQuery"
      @focus="isOpen = true"
      @input="handleInput"
      @blur="closeDelayed"
      placeholder="Type Name (Last, First)..."
      class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
      :class="{'border-red-300': hasError}"
    />
    
    <div v-if="isOpen && filteredMembers.length > 0" 
         class="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
      <div
        v-for="member in filteredMembers"
        :key="member.id"
        @mousedown.prevent="selectMember(member)"
        class="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white group"
      >
        <div class="flex flex-col">
          <span class="font-medium block truncate">
            {{ member.LastName }}, {{ member.FirstName }}
          </span>
          <span class="text-xs text-gray-500 group-hover:text-indigo-200">
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

const props = defineProps(['modelValue']) // This receives the 'email'
const emit = defineEmits(['update:modelValue'])

const store = useMembersStore()
const isOpen = ref(false)
const searchQuery = ref('')
const hasError = ref(false)

// Initialize list if empty
onMounted(() => {
  if (store.members.length === 0) store.initMembers()
})

// Sync: If the parent passes in an email (e.g. viewing an old log), set the text box to the Name
watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    searchQuery.value = ''
    return
  }
  const found = store.getMemberByEmail(newVal)
  if (found) {
    searchQuery.value = `${found.LastName}, ${found.FirstName}`
  } else {
    searchQuery.value = newVal // Fallback if name not found
  }
}, { immediate: true })

const filteredMembers = computed(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value.toLowerCase()
  
  // Return top 10 matches
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
  // If user clears box, clear the email value
  if (!searchQuery.value) emit('update:modelValue', '')
}

const selectMember = (member) => {
  searchQuery.value = `${member.LastName}, ${member.FirstName}`
  emit('update:modelValue', member.Email) // Send EMAIL back to parent
  isOpen.value = false
}

// Close dropdown with slight delay to allow click events to register
const closeDelayed = () => {
  setTimeout(() => isOpen.value = false, 200)
}
</script>