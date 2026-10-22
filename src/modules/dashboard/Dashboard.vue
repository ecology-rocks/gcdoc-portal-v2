<template>
  <div class="dashboard-container">

    <div class="welcome-header">
      <h1>Welcome, {{ welcomeName }}!</h1>
    </div>

    <template v-if="authStore.isAdmin">
      <!-- 1. Upload a sheet -->
      <section class="panel">
        <label class="upload-btn" :class="{ busy: uploading }">
          <input type="file" accept="image/*" class="hidden-input" :disabled="uploading" @change="uploadSheet">
          <span class="upload-icon">📷</span>
          <span>{{ uploading ? 'Uploading...' : 'Upload a Sheet' }}</span>
        </label>
        <p v-if="uploadedSheet" class="upload-done">
          ✓ Sheet #{{ uploadedSheet.shortId }} uploaded.
          <RouterLink to="/logs?tab=sheets">Enter its logs &rarr;</RouterLink>
        </p>
        <p v-if="uploadError" class="upload-error">✗ {{ uploadError }}</p>
      </section>

      <!-- 2 & 3. Find a member: contact info, hours, dues -->
      <section class="panel">
        <h2 class="section-title">Find a Member</h2>
        <input
          v-model="search"
          type="search"
          class="search-input"
          placeholder="Name, email, or phone"
          autocomplete="off"
        >

        <div v-if="search.trim().length >= 2" class="results">
          <div v-if="matches.length === 0" class="empty">No members match "{{ search }}".</div>

          <div v-for="m in matches" :key="m.id" class="member-card">
            <div class="member-head">
              <div>
                <div class="member-name">{{ m.FirstName }} {{ m.LastName }}</div>
                <div v-if="m.FirstName2" class="member-sub">& {{ m.FirstName2 }} {{ m.LastName2 }}</div>
              </div>
              <span class="type-badge">{{ m.MembershipType || '—' }}</span>
            </div>

            <div class="member-stats">
              <span>This FY: <strong>{{ fyHours(m, logsStore.fiscalYearHours) }} hrs</strong></span>
              <span>Last FY: <strong>{{ fyHours(m, logsStore.lastFiscalYearHours) }} hrs</strong></span>
              <DuesStatusBadge :member="m" />
            </div>

            <div class="contact-list">
              <a v-if="m.Email" :href="`mailto:${m.Email}`" class="contact">✉️ {{ m.Email }}</a>
              <div v-for="p in phones(m)" :key="p.number" class="contact-row">
                <a :href="`tel:${digits(p.number)}`" class="contact">📞 {{ p.number }}<span v-if="p.type" class="phone-type"> ({{ p.type }})</span></a>
                <a :href="`sms:${digits(p.number)}`" class="contact-sms">Text</a>
              </div>
            </div>

            <RouterLink :to="{ path: '/members', query: { q: m.Email } }" class="open-link">
              Open in Members (report, add hours) &rarr;
            </RouterLink>
          </div>

          <div v-if="moreCount > 0" class="empty">{{ moreCount }} more - keep typing to narrow it down.</div>
        </div>
      </section>
    </template>

    <!-- Non-admin members keep their own hours tools -->
    <div v-else class="volunteer-split-view">
      <div class="split-left">
        <MemberLogWizard />
      </div>
      <div class="split-right">
        <PersonalLogHistory />
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'
import { useSheetsStore } from '@/stores/sheetsStore'
import DuesStatusBadge from '@/components/admin/DuesStatusBadge.vue'
import MemberLogWizard from '@/modules/memberlogs/components/MemberLogWizard.vue'
import PersonalLogHistory from '@/modules/memberlogs/components/PersonalLogHistory.vue'

const MAX_RESULTS = 8

const authStore = useAuthStore()
const membersStore = useMembersStore()
const logsStore = useLogsStore()
const sheetsStore = useSheetsStore()

const search = ref('')
const uploading = ref(false)
const uploadedSheet = ref(null)
const uploadError = ref('')

onMounted(async () => {
  await authStore.ensureProfileLoaded()
  if (authStore.isAdmin) {
    await Promise.all([membersStore.initMembers(), logsStore.initLogs()])
  }
})

const welcomeName = computed(() => authStore.profile?.FirstName || 'Member')

const digits = (value) => String(value || '').replace(/[^\d+]/g, '')

const phones = (m) => [
  { number: m.Phone1, type: m.Phone1Type },
  { number: m.Phone2, type: m.PhoneType2 },
  { number: m.Phone3, type: m.PhoneType3 }
].filter(p => p.number)

const fyHours = (m, hoursMap) => {
  const hrs = hoursMap[(m.Email || '').toLowerCase()] || 0
  return Math.round(hrs * 100) / 100
}

const allMatches = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (term.length < 2) return []
  const termDigits = term.replace(/\D/g, '')

  return membersStore.members
    .filter(m => {
      const names = [
        `${m.FirstName || ''} ${m.LastName || ''}`,
        `${m.FirstName2 || ''} ${m.LastName2 || ''}`,
        m.Email || ''
      ].join(' ').toLowerCase()
      if (names.includes(term)) return true
      // Phone search only once there are enough digits to be meaningful
      return termDigits.length >= 3 && phones(m).some(p => digits(p.number).includes(termDigits))
    })
    // Inactive members sink to the bottom rather than disappearing
    .sort((a, b) => {
      const ai = (a.MembershipType || '').toLowerCase() === 'inactive' ? 1 : 0
      const bi = (b.MembershipType || '').toLowerCase() === 'inactive' ? 1 : 0
      return ai - bi || (a.LastName || '').localeCompare(b.LastName || '')
    })
})

const matches = computed(() => allMatches.value.slice(0, MAX_RESULTS))
const moreCount = computed(() => Math.max(0, allMatches.value.length - MAX_RESULTS))

const uploadSheet = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  uploading.value = true
  uploadedSheet.value = null
  uploadError.value = ''
  try {
    uploadedSheet.value = await sheetsStore.uploadSheet(file, authStore.user?.email || 'admin')
  } catch (e) {
    uploadError.value = 'Upload failed: ' + e.message
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}
</script>

<style scoped>
.dashboard-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem 0;
  font-family: system-ui, -apple-system, sans-serif;
}

.welcome-header {
  margin-bottom: 1.25rem;
}

.welcome-header h1 {
  font-size: 1.75rem;
  font-weight: 800;
  color: #1f2937;
  margin: 0;
  letter-spacing: -0.025em;
}

.panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin: 0 0 0.75rem;
}

/* --- Upload --- */
.hidden-input { display: none; }

.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  padding: 1.1rem;
  background: #4f46e5;
  color: white;
  font-size: 1.15rem;
  font-weight: 700;
  border-radius: 0.6rem;
  cursor: pointer;
  box-sizing: border-box;
}
.upload-btn:active { background: #4338ca; }
.upload-btn.busy { background: #94a3b8; cursor: wait; }
.upload-icon { font-size: 1.4rem; }

.upload-done { margin: 0.75rem 0 0; color: #15803d; font-weight: 600; }
.upload-done a { color: #4f46e5; margin-left: 0.25rem; }
.upload-error { margin: 0.75rem 0 0; color: #b91c1c; font-weight: 600; }

/* --- Member search --- */
.search-input {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  box-sizing: border-box;
}
.search-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }

.results {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty { color: #6b7280; font-size: 0.9rem; text-align: center; padding: 0.5rem; }

.member-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.6rem;
  padding: 0.85rem;
}

.member-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.member-name { font-weight: 700; font-size: 1.05rem; color: #111827; }
.member-sub { font-size: 0.85rem; color: #6b7280; }

.type-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
}

.member-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin: 0.6rem 0;
  font-size: 0.9rem;
  color: #374151;
}

.contact-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.contact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.contact {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.95rem;
  padding: 0.25rem 0;
  word-break: break-all;
}
.phone-type { color: #6b7280; font-size: 0.85rem; }

.contact-sms {
  font-size: 0.8rem;
  font-weight: 600;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  border-radius: 0.375rem;
  padding: 0.25rem 0.6rem;
  text-decoration: none;
}

.open-link {
  display: inline-block;
  margin-top: 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4f46e5;
  text-decoration: none;
}

/* --- Non-admin view --- */
.volunteer-split-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
</style>
