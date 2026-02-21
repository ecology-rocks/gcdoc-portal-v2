import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import Login from '@/views/Login.vue'

// Modules
import LogManager from '@/modules/memberlogs/LogManager.vue'
import CsvImporter from '@/utils/CsvImporter.vue'
import MemberForm from '@/modules/members/MemberForm.vue'
import MemberManager from '@/modules/members/MemberManager.vue' 
import MeetingView from '@/modules/admin/MeetingView.vue'
import RegistrarView from '@/modules/admin/RegistrarView.vue' // [NEW IMPORT]
import ClassDashboard from '@/modules/classes/ClassDashboard.vue'
import KioskView from '@/views/KioskView.vue'
import AttendanceSheet from '@/modules/admin/AttendanceSheet.vue'
import Dashboard from '@/modules/dashboard/Dashboard.vue'
import WordPressSync from '@/modules/admin/WordPressSync.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/kiosk',
      name: 'kiosk',
      component: KioskView,
      // No 'requiresAuth' meta
    },
    {
      path: '/',
      redirect: '/dashboard',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'dashboard', component: Dashboard },
        { path: 'wordpress', name: 'wp-sync', component: WordPressSync },
        { path: 'logs', name: 'logs', component: LogManager },
        { path: 'meeting', name: 'meeting', component: MeetingView },
        { path: 'import', name: 'import', component: CsvImporter },
        { path: 'meeting/attendance', name: 'attendance', component: AttendanceSheet },
        // Registrar / Classes
        { path: 'registrar', name: 'registrar', component: RegistrarView }, // [NEW ROUTE]
        { path: 'classes', name: 'classes', component: ClassDashboard },

        // Members
        {
          path: 'members',       
          name: 'members',
          component: MemberManager
        },
        {
          path: 'members/add',
          name: 'add-member',
          component: MemberForm
        },
        {
          path: 'members/edit/:id',
          name: 'edit-member',
          component: MemberForm
        },
      ]
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  if (authStore.loading) await authStore.init()

  if (to.meta.requiresAuth && !authStore.user) {
    next('/kiosk')
  } else if (to.path === '/login' && authStore.user) {
    next('/')
  } else {
    next()
  }
})

export default router