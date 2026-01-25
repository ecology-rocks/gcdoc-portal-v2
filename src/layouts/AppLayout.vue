<template>
  <div class="flex h-screen bg-gray-100 font-sans">
    <aside class="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl print:hidden">

      <div class="p-6 border-b border-slate-800">
        <h1 class="text-2xl font-bold text-white tracking-tight">GCDOC</h1>

        <div v-if="authStore.profile"
          class="mt-4 flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
          <div class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs">
            {{ getInitials(authStore.profile) }}
          </div>
          <div class="overflow-hidden">
            <p class="text-xs font-bold text-white truncate">
              {{ authStore.profile.FirstName }} {{ authStore.profile.LastName }}
            </p>
            <p class="text-[10px] text-slate-400 truncate uppercase tracking-wider">
              {{ authStore.profile.Role || 'Member' }}
            </p>
          </div>
        </div>
        <div v-else class="mt-2 text-xs text-slate-500 animate-pulse">
          Loading profile...
        </div>
      </div>

      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        <RouterLink to="/dashboard" active-class="bg-indigo-600 text-white shadow-lg shadow-indigo-900/50"
          class="flex items-center px-4 py-3 rounded-lg transition-all hover:bg-slate-800 hover:text-white group mb-4">
          <span class="mr-3 text-lg">📊</span>
          <span class="font-medium">Dashboard</span>
        </RouterLink>

        <div class="px-4 pb-2 mt-2">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Teacher Tools</p>
        </div>
        <RouterLink v-if="classStore.isTeacher" to="/classes"
          active-class="bg-slate-800 text-white border-l-4 border-indigo-500"
          class="flex items-center px-4 py-2 rounded-r-lg transition-colors hover:bg-slate-800 hover:text-white group text-sm">
          <span class="mr-3">🎓</span>
          My Classes
        </RouterLink>
        <RouterLink to="/registrar" active-class="bg-slate-800 text-white border-l-4 border-indigo-500" class="flex items-center px-4 py-2 rounded-r-lg transition-colors hover:bg-slate-800 hover:text-white group text-sm">
          <span class="mr-3">📋</span> Registrar
        </RouterLink>


        <div class="px-4 pb-2 mt-2">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Admin Tools</p>
        </div>

        <RouterLink to="/meeting" active-class="bg-slate-800 text-white border-l-4 border-indigo-500"
          class="flex items-center px-4 py-2 rounded-r-lg transition-colors hover:bg-slate-800 hover:text-white group text-sm">
          <span class="mr-3">📅</span> Meeting Prep
        </RouterLink>

        <RouterLink to="/logs" active-class="bg-slate-800 text-white border-l-4 border-indigo-500"
          class="flex items-center px-4 py-2 rounded-r-lg transition-colors hover:bg-slate-800 hover:text-white group text-sm">
          <span class="mr-3">📝</span> Logs & Sheets
        </RouterLink>
        <RouterLink to="/members" active-class="bg-slate-800 text-white border-l-4 border-indigo-500"
          class="flex items-center px-4 py-2 rounded-r-lg transition-colors hover:bg-slate-800 hover:text-white group text-sm">
          <span class="mr-3">👥</span> Members
        </RouterLink>

      </nav>

      <div class="p-4 border-t border-slate-800 space-y-2">
        <RouterLink to="/import"
          class="flex items-center px-4 py-2 text-xs text-yellow-600 hover:text-yellow-500 hover:bg-slate-800 rounded transition-colors">
          <span class="mr-2">⚠️</span> Data Importer
        </RouterLink>

        <button @click="handleLogout"
          class="w-full flex items-center px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors text-left">
          <span class="mr-2">🚪</span> Sign Out
        </button>
      </div>
    </aside>

    <main class="flex-1 overflow-y-auto">
      <header class="bg-white shadow-sm sticky top-0 z-30 print:hidden">
        <div class="px-8 py-4 flex justify-between items-center">
          <h2 class="text-xl font-bold text-gray-800 capitalize tracking-tight">
            {{ currentRouteName }}
          </h2>
        </div>
      </header>

      <div class="p-8 print:p-0">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useClassStore } from '@/stores/classStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const classStore = useClassStore()
classStore.initClasses()

// Helper for UI
const currentRouteName = computed(() => {
  if (route.name === 'dashboard') return 'Dashboard'
  if (route.name === 'logs') return 'Log Manager'
  if (route.name === 'meeting') return 'Meeting Prep'
  if (route.name === 'import') return 'Data Tools'
  return ''
})

const getInitials = (profile) => {
  if (!profile) return '?'
  const f = profile.FirstName ? profile.FirstName[0] : ''
  const l = profile.LastName ? profile.LastName[0] : ''
  return (f + l).toUpperCase()
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>