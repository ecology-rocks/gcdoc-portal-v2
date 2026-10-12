import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import Login from '@/views/Login.vue'

// Modules
import LogManager from '@/modules/memberlogs/LogManager.vue'
import CsvImporter from '@/utils/CsvImporter.vue'
import MemberForm from '@/modules/members/MemberForm.vue'
import MemberManager from '@/modules/members/MemberManager.vue' 
import MeetingView from '@/modules/admin/MeetingView.vue'
import KioskView from '@/views/KioskView.vue'
import MeetingPrintable from '@/modules/admin/MeetingPrintable.vue'
import VouchersView from '@/modules/admin/VouchersView.vue'
import VoucherPrint from '@/modules/admin/VoucherPrint.vue'
import Dashboard from '@/modules/dashboard/Dashboard.vue'

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
        { path: 'logs', name: 'logs', component: LogManager, meta: { role: 'admin' } },
        { path: 'meeting', name: 'meeting', component: MeetingView, meta: { role: 'admin' } },
        { path: 'import', name: 'import', component: CsvImporter, meta: { role: 'admin' } },
        { path: 'vouchers', name: 'vouchers', component: VouchersView, meta: { role: 'admin' } },
        { path: 'vouchers/print', name: 'voucher-print', component: VoucherPrint, meta: { role: 'admin' } },
        { path: 'meeting/print/:kind?', name: 'meeting-print', component: MeetingPrintable, meta: { role: 'admin' } },
        // Members
        {
          path: 'members',       
          name: 'members',
          component: MemberManager,
          meta: { role: 'admin' }
        },
        {
          path: 'members/add',
          name: 'add-member',
          component: MemberForm,
          meta: { role: 'admin' }
        },
        {
          path: 'members/edit/:id',
          name: 'edit-member',
          component: MemberForm,
          meta: { role: 'admin' }
        },
      ]
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  if (authStore.loading) await authStore.init()

  if (authStore.user) {
    await authStore.ensureProfileLoaded()
  }

  if (authStore.isKioskUser && to.path !== '/kiosk') {
    next('/kiosk')
    return
  }

  if (to.meta.requiresAuth && !authStore.user) {
    next('/kiosk')
    return
  }

  if (to.path === '/login' && authStore.user) {
    next(authStore.isKioskUser ? '/kiosk' : '/')
    return
  }

  const requiredRole = to.meta.role
  if (requiredRole) {
    const hasAccess =
      requiredRole === 'admin' && authStore.isAdmin

    if (!hasAccess) {
      next('/dashboard')
      return
    }
  }

  next()
})

export default router