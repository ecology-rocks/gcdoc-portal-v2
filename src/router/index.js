import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import Login from '@/views/Login.vue'

// Modules
import LogManager from '@/modules/memberlogs/LogManager.vue'
import CsvImporter from '@/utils/CsvImporter.vue'
import MemberForm from '@/modules/members/MemberForm.vue'
import MemberManager from '@/modules/members/MemberManager.vue' // <--- IMPORT NEW FILE
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
        { path: 'dashboard', name: 'dashboard', component: LogManager },
        { path: 'logs', name: 'logs', component: LogManager },
        { path: 'meeting', name: 'meeting', component: MeetingView },
        { path: 'import', name: 'import', component: CsvImporter },

        // --- MEMBER ROUTES ---
        {
          path: 'members',        // Listing Page
          name: 'members',
          component: MemberManager
        },
        // Inside routes array, under children:
        {
          path: 'members/add',
          name: 'add-member',
          component: MemberForm
        },
        // NEW ROUTE
        {
          path: 'members/edit/:id',
          name: 'edit-member',
          component: MemberForm
        },
      ]
    }
  ]
})

// Navigation Guard... (Keep existing guard code)
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
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