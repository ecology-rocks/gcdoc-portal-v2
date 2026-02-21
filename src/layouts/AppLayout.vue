<template>
  <div class="app-layout">
    
    <div 
      v-if="sidebarOpen" 
      class="sidebar-overlay"
      @click="sidebarOpen = false"
    ></div>

    <aside class="sidebar" :class="{ 'is-open': sidebarOpen }">
      
      <div class="sidebar-header">
        <h1>GCDOC</h1>
        <button class="close-btn" @click="sidebarOpen = false">×</button>
      </div>

      <div class="profile-section">
        <div v-if="authStore.profile" class="profile-card">
          <div class="avatar">
            {{ getInitials(authStore.profile) }}
          </div>
          <div class="profile-info">
            <p class="profile-name">
              {{ authStore.profile.FirstName }} {{ authStore.profile.LastName }}
            </p>
            <p class="profile-role">
              {{ authStore.profile.Role || 'Member' }}
            </p>
          </div>
        </div>
        <div v-else class="loading-text">
          Loading profile...
        </div>
      </div>

      <nav class="sidebar-nav">
        <RouterLink to="/dashboard" class="nav-item" active-class="active" @click="closeSidebar">
          <span class="icon">📊</span>
          <span class="label">Dashboard</span>
        </RouterLink>

        <div v-if="classStore.isTeacher" class="nav-divider">Teacher Tools</div>
        
        <RouterLink v-if="classStore.isTeacher" to="/classes" class="nav-item" active-class="active" @click="closeSidebar">
          <span class="icon">🎓</span> My Classes
        </RouterLink>

        <div v-if="authStore.isRegistrar" class="nav-divider">Registrar</div>
        <RouterLink v-if="authStore.isRegistrar" to="/registrar" class="nav-item" active-class="active" @click="closeSidebar">
          <span class="icon">📋</span> Registration
        </RouterLink>

        <div v-if="authStore.isAdmin" class="nav-divider">Admin Tools</div>

        <template v-if="authStore.isAdmin">
          <RouterLink to="/meeting" class="nav-item" active-class="active" @click="closeSidebar">
            <span class="icon">📅</span> Meeting Prep
          </RouterLink>
          <RouterLink to="/logs" class="nav-item" active-class="active" @click="closeSidebar">
            <span class="icon">📝</span> Logs & Sheets
          </RouterLink>
          <RouterLink to="/members" class="nav-item" active-class="active" @click="closeSidebar">
            <span class="icon">👥</span> Members
          </RouterLink>
        </template>
      </nav>

      <div class="sidebar-footer">
        <RouterLink to="/kiosk" class="footer-link">✍🏻 Go To Kiosk</RouterLink>
        <RouterLink v-if="authStore.isAdmin" to="/import" class="footer-link warning" @click="closeSidebar">
          ⚠️ Data Importer
        </RouterLink>
        <button @click="handleLogout" class="footer-link">
          🚪 Sign Out
        </button>
      </div>
    </aside>

    <main class="main-content">
      <header class="top-bar">
        <button class="hamburger-btn" @click="sidebarOpen = !sidebarOpen">
          ☰
        </button>
        
      </header>

      <div class="content-area">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useClassStore } from '@/stores/classStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const classStore = useClassStore()
classStore.initClasses()

const sidebarOpen = ref(false)

const closeSidebar = () => {
  sidebarOpen.value = false
}

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

<style>
@media print {
  /* Critical: Reset the outer containers so content can flow across pages */
  html, body, #app {
    height: auto !important;
    width: 100% !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    background-color: white !important;
  }

  /* Hide the scrollbars from the print view */
  ::-webkit-scrollbar {
    display: none;
  }
}
</style>

<style scoped>
/* --- Layout Variables --- */
:root {
  --sidebar-width: 260px;
  --header-height: 60px;
  --bg-color: #f3f4f6;
  --sidebar-bg: #0f172a;
  --sidebar-text: #cbd5e1;
  --primary-color: #4f46e5;
}

/* --- Main Layout Container --- */
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-color);
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

/* --- Sidebar Styles --- */
.sidebar {
  width: 260px;
  background-color: #0f172a;
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  height: 100%;
  
  /* Mobile: Fixed & Hidden by default */
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 50;
  transform: translateX(-100%);
  transition: transform 0.3s ease-in-out;
  box-shadow: 4px 0 15px rgba(0,0,0,0.1);
}

.sidebar.is-open {
  transform: translateX(0);
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h1 {
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #cbd5e1;
  font-size: 2rem;
  cursor: pointer;
  line-height: 1;
  display: block; /* Visible on mobile */
}

/* --- Profile Section --- */
.profile-section {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255,255,255,0.05);
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.05);
}

.avatar {
  width: 32px;
  height: 32px;
  background-color: #4f46e5;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.profile-info {
  overflow: hidden;
}

.profile-name {
  color: white;
  font-weight: bold;
  font-size: 0.85rem;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-role {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin: 0;
}

/* --- Navigation --- */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  color: #cbd5e1;
  text-decoration: none;
  border-radius: 0.5rem;
  margin-bottom: 0.25rem;
  transition: background 0.2s;
}

.nav-item:hover {
  background-color: rgba(255,255,255,0.05);
  color: white;
}

.nav-item.active {
  background-color: #4f46e5; /* Indigo */
  color: white;
}

.nav-item .icon {
  margin-right: 0.75rem;
  font-size: 1.1rem;
}

.nav-divider {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  padding-left: 1rem;
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.05em;
}

/* --- Footer --- */
.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.footer-link {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: #94a3b8;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: 0.375rem;
  text-decoration: none;
}

.footer-link:hover {
  background-color: rgba(255,255,255,0.05);
  color: white;
}

.footer-link.warning {
  color: #eab308; /* Yellow */
}

/* --- Main Content --- */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.top-bar {
  background: white;
  padding: 1rem 2rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  z-index: 10;
}

.top-bar h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
}

.hamburger-btn {
  display: block; /* Visible on mobile */
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  margin-right: 1rem;
  padding: 0.25rem;
  color: #4b5563;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

/* --- Mobile Overlay --- */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 40;
  backdrop-filter: blur(2px);
}

/* --- DESKTOP BREAKPOINT --- */
@media (min-width: 768px) {
  .sidebar {
    position: static; /* Flows naturally in flex container */
    transform: none; /* Always visible */
    box-shadow: none;
  }
  
  .close-btn {
    display: none;
  }

  .hamburger-btn {
    display: none;
  }

  .sidebar-overlay {
    display: none !important;
  }

  /* Remove top bar padding/margin shifts if needed */
  .top-bar {
    padding: 0;
  }
}

/* --- PRINT OVERRIDES (Updated) --- */
@media print {
  /* 1. Hide Interface Elements */
  .sidebar, 
  .top-bar, 
  .sidebar-overlay,
  .hamburger-btn,
  .sidebar-footer,
  .nav-item {
    display: none !important;
  }

  /* 2. Unwrap the Layout */
  .app-layout,
  .main-content,
  .content-area {
    display: block !important;
    position: static !important;
    height: auto !important;
    width: 100% !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    background-color: white !important;
  }

  /* 3. Ensure Text Contrast */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color: black !important;
    box-shadow: none !important;
  }
}
</style>