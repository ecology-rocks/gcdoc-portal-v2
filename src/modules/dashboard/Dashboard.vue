<template>
  <div class="dashboard-container">
    
    <div class="welcome-header">
      <h1>Welcome, {{ authStore.profile?.FirstName || 'Member' }}!</h1>
      <p>Manage the club and track your contributions.</p>
    </div>

    <div class="section-container">
      <h2 class="section-title">My Schedule</h2>
      <div class="dashboard-grid">
        
        <div class="card card-purple">
          <div class="card-body">
            <div class="card-icon purple-bg">
              <span>🎒</span>
            </div>
            <div class="card-info">
              <dt>Enrolled Classes</dt>
              <dd>{{ studentClassCount }} Classes</dd>
            </div>
          </div>
          <div class="card-footer">
            <RouterLink to="/classes" class="link-purple">
              View Schedule &rarr;
            </RouterLink>
          </div>
        </div>

        <div v-if="classStore.isTeacher" class="card card-teal">
          <div class="card-body">
            <div class="card-icon teal-bg">
              <span>🍎</span>
            </div>
            <div class="card-info">
              <dt>Instructing</dt>
              <dd>{{ teacherClassCount }} Classes</dd>
            </div>
          </div>
          <div class="card-footer">
            <RouterLink to="/classes" class="link-teal">
              Manage Students &rarr;
            </RouterLink>
          </div>
        </div>

      </div>
    </div>

    <div v-if="hasSpecialRole" class="section-container">
      <h2 class="section-title">Management Tools</h2>
      <div class="dashboard-grid">
        
        <div v-if="authStore.isAdmin" class="card card-blue">
          <div class="card-body">
            <div class="card-icon blue-bg">
              <span>📅</span>
            </div>
            <div class="card-info">
              <dt>Board Meeting</dt>
              <dd>Prep Tools</dd>
            </div>
          </div>
          <div class="card-footer">
            <RouterLink to="/meeting" class="link-blue">
              View applicants & hours &rarr;
            </RouterLink>
          </div>
        </div>

        <div v-if="authStore.isAdmin" class="card card-yellow">
          <div class="card-body">
            <div class="card-icon yellow-bg">
              <span>💾</span>
            </div>
            <div class="card-info">
              <dt>System Data</dt>
              <dd>Import CSVs</dd>
            </div>
          </div>
          <div class="card-footer">
            <RouterLink to="/import" class="link-yellow">
              Run Importer &rarr;
            </RouterLink>
          </div>
        </div>

        <div v-if="authStore.isRegistrar" class="card card-green">
          <div class="card-body">
            <div class="card-icon green-bg">
              <span>📋</span>
            </div>
            <div class="card-info">
              <dt>Registrar</dt>
              <dd>Manage Classes</dd>
            </div>
          </div>
          <div class="card-footer">
            <RouterLink to="/registrar" class="link-green">
              View Class Roster &rarr;
            </RouterLink>
          </div>
        </div>

      </div>
    </div>

    <div class="section-container">
      <h2 class="section-title">Volunteer Hours</h2>
      
      <div class="volunteer-split-view">
        <div class="split-left">
          <MemberLogWizard />
        </div>
        <div class="split-right">
          <PersonalLogHistory />
        </div>
      </div>

    </div>

  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useClassStore } from '@/stores/classStore'
import MemberLogWizard from '@/modules/memberlogs/components/MemberLogWizard.vue'
import PersonalLogHistory from '@/modules/memberlogs/components/PersonalLogHistory.vue'

const authStore = useAuthStore()
const classStore = useClassStore()

onMounted(() => {
  classStore.initClasses()
})

const hasSpecialRole = computed(() => {
  return authStore.isAdmin || authStore.isRegistrar
})

// Calculate counts for the Chips
const studentClassCount = computed(() => {
  return classStore.myClasses.filter(c => classStore.isStudentOf(c.id)).length
})

const teacherClassCount = computed(() => {
  return classStore.myClasses.filter(c => classStore.isTeacherOf(c.id)).length
})
</script>

<style scoped>
.dashboard-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.welcome-header {
  text-align: center;
  margin-bottom: 3rem;
}

.welcome-header h1 {
  font-size: 2.25rem;
  font-weight: 800;
  color: #1f2937;
  margin: 0;
  letter-spacing: -0.025em;
}

.welcome-header p {
  color: #6b7280;
  font-size: 1.125rem;
  margin-top: 0.5rem;
}

.section-container {
  margin-bottom: 4rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.75rem;
}

/* Grid Layout */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

/* Split View Layout */
.volunteer-split-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Desktop Breakpoints */
@media (min-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .volunteer-split-view {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    align-items: start;
    gap: 2rem;
  }
}

/* Card Styles */
.card {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
  overflow: hidden;
  border: 1px solid #f3f4f6;
  border-left-width: 4px;
  border-left-style: solid;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
}

.card-body {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  flex: 1;
}

.card-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.card-info {
  margin-left: 1rem;
}

.card-info dt {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
}

.card-info dd {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.card-footer {
  background-color: #f9fafb;
  padding: 0.75rem 1.5rem;
  border-top: 1px solid #f3f4f6;
}

.card-footer a {
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  display: block;
  transition: color 0.2s;
}

.card-footer a:hover {
  text-decoration: underline;
}

/* Card Colors */
.card-purple { border-left-color: #a855f7; }
.purple-bg { background-color: #faf5ff; color: #a855f7; }
.link-purple { color: #9333ea; }

.card-teal { border-left-color: #14b8a6; }
.teal-bg { background-color: #ccfbf1; color: #0d9488; }
.link-teal { color: #0f766e; }

.card-blue { border-left-color: #3b82f6; }
.blue-bg { background-color: #eff6ff; color: #3b82f6; }
.link-blue { color: #2563eb; }

.card-yellow { border-left-color: #eab308; }
.yellow-bg { background-color: #fefce8; color: #eab308; }
.link-yellow { color: #ca8a04; }

.card-green { border-left-color: #22c55e; }
.green-bg { background-color: #f0fdf4; color: #22c55e; }
.link-green { color: #16a34a; }
</style>