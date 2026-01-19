import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import Login from '@/views/Login.vue'

// --- EXISTING COMPONENTS ---
import LogManager from '@/modules/memberlogs/LogManager.vue'
import CsvImporter from '@/utils/CsvImporter.vue'
import MeetingView from '@/modules/admin/MeetingView.vue' 

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/',
      redirect: '/dashboard',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        // Dashboard currently uses LogManager as the default view
        { 
          path: 'dashboard', 
          name: 'dashboard', 
          component: LogManager 
        },
        // Log Manager
        { 
          path: 'logs', 
          name: 'logs', 
          component: LogManager 
        },
        // Meeting Prep (Commented out until file exists to prevent build error)
        { 
          path: 'meeting', 
          name: 'meeting', 
          component: MeetingView 
        },
        // Importer
        { 
          path: 'import', 
          name: 'import', 
          component: CsvImporter 
        },
      ]
    }
  ]
})

// Navigation Guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Ensure init is done before checking auth
  if (authStore.loading) await authStore.init()

  if (to.meta.requiresAuth && !authStore.user) {
    next('/login')
  } else if (to.path === '/login' && authStore.user) {
    next('/')
  } else {
    next()
  }
})

export default router