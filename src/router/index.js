import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import Login from '@/views/Login.vue'
// We will create these components next
import Dashboard from '@/modules/dashboard/Dashboard.vue'
import MeetingView from '@/modules/admin/MeetingView.vue'
import MemberList from '@/modules/members/MemberList.vue'
import LogManager from '@/modules/logs/LogManager.vue'
import CsvImporter from '@/utils/CsvImporter.vue'
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
      redirect: '/dashboard', // Redirect root to dashboard
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'dashboard', component: LogManager }, // Using LogManager as dashboard for now
        { path: 'meeting', name: 'meeting', component: MeetingView },
        { path: 'logs', name: 'logs', component: LogManager },
        { path: 'import', name: 'import', component: CsvImporter },
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