<template>
  <div class="max-w-7xl mx-auto py-6 px-4">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Members</h1>
      <span class="text-sm text-gray-500" v-if="!loading">{{ members.length }} records found</span>
    </div>

    <div v-if="loading" class="text-center py-10 text-gray-500">Loading members...</div>

    <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
      <ul role="list" class="divide-y divide-gray-200">
        <li v-for="member in members" :key="member.id">
          <div class="px-4 py-4 sm:px-6 hover:bg-gray-50">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-blue-600 truncate">
                {{ member.LastName }}, {{ member.FirstName }}
              </p>
              <div class="ml-2 flex-shrink-0 flex">
                <p class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                   :class="member.Status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'">
                  {{ member.Status }}
                </p>
              </div>
            </div>
            <div class="mt-2 sm:flex sm:justify-between">
              <div class="sm:flex">
                <p class="flex items-center text-sm text-gray-500">
                  {{ member.Email }}
                </p>
              </div>
              <div class="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                <p>{{ member.MembershipType }}</p>
              </div>
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