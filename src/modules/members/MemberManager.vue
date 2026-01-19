<template>
    <div class="h-full flex flex-col">
        <div class="flex justify-between items-center mb-6">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Member Directory</h1>
                <p class="text-sm text-gray-500">{{ filteredMembers.length }} active records found</p>
            </div>
            <div class="flex gap-3">
                <input v-model="search" type="text" placeholder="Search members..."
                    class="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                <button @click="$router.push('/members/add')"
                    class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2">
                    <span>+</span> Add Member
                </button>
            </div>
        </div>

        <div class="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
            <div class="overflow-y-auto flex-1">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 sticky top-0">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Member</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Contact</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="m in filteredMembers" :key="m.id" class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-bold text-gray-900">{{ m.LastName }}, {{ m.FirstName }}</div>
                                <div v-if="m.FirstName2" class="text-xs text-gray-500">& {{ m.FirstName2 }} {{
                                    m.LastName2 }}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm text-gray-900">{{ m.Email }}</div>
                                <div class="text-xs text-gray-500">{{ m.Phone1 }}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span
                                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {{ m.MembershipType }}
                                </span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase text-xs font-bold">
                                {{ m.Role }}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button @click="$router.push(`/members/edit/${m.Email}`)"
                                    class="text-indigo-600 hover:text-indigo-900 font-bold">
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