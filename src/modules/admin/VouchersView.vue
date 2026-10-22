<template>
  <div class="vouchers-view">
    <div class="page-header">
      <div>
        <h1>Vouchers</h1>
        <p class="subtitle">Earned vouchers by fiscal year (Oct 1 - Sep 30), and the voucher cards that track them. Members see their cards on the website once they're published.</p>
      </div>
      <div class="header-actions">
        <label class="fy-select">
          Fiscal year
          <select v-model.number="fyStartYear">
            <option v-for="y in fiscalYearOptions" :key="y" :value="y">{{ fyName(y) }}</option>
          </select>
        </label>
        <RouterLink :to="{ name: 'voucher-print', query: { fy: fyStartYear } }" class="btn-secondary">🖨️ Print cards</RouterLink>
        <button class="btn-primary" @click="openIssue('trial')">➕ Issue vouchers</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading logs...</div>

    <template v-else>
      <p v-if="vouchersStore.error" class="error">{{ vouchersStore.error }}</p>

      <!-- At a glance: what hours earned, and where the cards stand -->
      <div class="glance">
        <div class="tile">
          <div class="tile-label">Earned from hours</div>
          <div class="tile-main">{{ totals.service }} <small>service</small> · <span class="blue-text">{{ totals.blue }}</span> <small>Blue Ribbon</small></div>
          <div class="tile-sub">{{ totals.earners }} members earning · {{ totals.logged }} logged hours</div>
        </div>
        <div v-if="totals.pendingPeople" class="tile pending">
          <div class="tile-label">Pending vote-in</div>
          <div class="tile-main">{{ totals.pendingService }} <small>service</small> · {{ totals.pendingBlue }} <small>Blue Ribbon</small></div>
          <div class="tile-sub">{{ totals.pendingPeople }} applicant{{ totals.pendingPeople === 1 ? '' : 's' }} - become earned once voted in</div>
        </div>
        <div v-for="t in ['class', 'blue']" :key="t" class="tile" :class="t">
          <div class="tile-label">{{ VOUCHER_TYPES[t].label }} cards</div>
          <div class="tile-main">{{ ledger[t].total }}</div>
          <div class="status-bar" :title="statusSummary(fyVouchers.filter(v => v.type === t))">
            <span v-for="s in STATUS_ORDER" :key="s" :class="'seg-' + s" :style="{ flex: ledger[t][s] }"></span>
          </div>
          <div class="tile-sub">
            <span v-for="s in STATUS_ORDER" :key="s" class="legend"><i :class="'seg-' + s"></i>{{ ledger[t][s] }} {{ STATUS_LABELS[s] }}</span>
          </div>
        </div>
      </div>

      <div v-if="missingCards.total" class="callout">
        <span>
          <strong>{{ missingCards.class }} service + {{ missingCards.blue }} Blue Ribbon</strong> earned vouchers don't have cards yet.
          <span class="hint">Safe to run again - it only adds what's missing (e.g. after an applicant is voted in).</span>
        </span>
        <span class="callout-actions">
          <button class="btn-secondary" @click="missingOpen = true">See who ({{ missingList.length }})</button>
          <button class="btn-primary" :disabled="creating" @click="createEarnedCards">
            {{ creating ? 'Creating...' : 'Create cards' }}
          </button>
        </span>
      </div>
      <p v-else-if="earnedForCards.length" class="all-set">✓ Every earned voucher for {{ fyName(fyStartYear) }} has a card.</p>

      <div v-if="isDev" class="dev-tools">
        <button class="dev-reset-btn" :disabled="unprintedEarned.length === 0 || resetting" @click="devResetEarnedCards">
          {{ resetting ? 'Resetting...' : `DEV: Reset ${unprintedEarned.length} unpublished earned cards` }}
        </button>
        <span class="hint">Deletes earned cards for {{ fyName(fyStartYear) }} that haven't been published, so they can be recreated from corrected hours.</span>
      </div>

      <!-- Hand-issued sets: one line each, details in a modal -->
      <section class="panel">
        <div class="panel-head">
          <h2>Issued by hand · {{ fyName(fyStartYear) }} <span class="count">{{ manualSets.length }}</span></h2>
          <div v-if="manualSets.length" class="panel-tools">
            <input v-model="setSearch" type="search" class="search small-search" placeholder="Find a set or person">
            <label class="toggle">
              <input v-model="setsNeedPublishing" type="checkbox">
              Unpublished only
            </label>
          </div>
        </div>

        <p v-if="!manualSets.length" class="empty-note">
          Nothing issued by hand for {{ fyName(fyStartYear) }} yet.
          <button class="btn-link" @click="openIssue('trial')">Issue vouchers</button>
        </p>
        <p v-else-if="!filteredSets.length" class="empty-note">No sets match.</p>

        <ul v-else class="set-list">
          <li v-for="s in visibleSets" :key="s.key" class="set-row">
            <button class="set-main" @click="openSet(s.key)">
              <span class="set-title">
                {{ s.label }}
                <span v-if="s.kind" class="badge badge-kind">{{ KIND_LABELS[s.kind] || s.kind }}</span>
                <span v-if="s.fromWebsite" class="badge badge-web">from website</span>
              </span>
              <span class="small">
                {{ s.people }} {{ s.people === 1 ? 'person' : 'people' }} · {{ statusSummary(s.vouchers) }}<template v-if="s.createdAt"> · issued {{ shortDate(s.createdAt) }}</template>
              </span>
            </button>
            <div class="row-actions">
              <RouterLink :to="{ name: 'voucher-print', query: { set: s.key, fy: fyStartYear } }" class="btn-link">🖨️ Print</RouterLink>
              <button v-if="s.vouchers.some(v => v.status === 'created')" class="btn-link" @click="publishCards(s.vouchers, s.label)">✓ Publish</button>
            </div>
          </li>
        </ul>

        <button v-if="filteredSets.length > SETS_COLLAPSED" class="show-more" @click="setsExpanded = !setsExpanded">
          {{ setsExpanded ? 'Show fewer' : `Show all ${filteredSets.length} sets` }}
        </button>
      </section>

      <!-- Earned vouchers per member -->
      <section class="panel">
        <div class="panel-head">
          <h2>Members · {{ fyName(fyStartYear) }}</h2>
          <button class="btn-secondary" :disabled="rows.length === 0" @click="exportCsv">⬇️ Export CSV</button>
        </div>

        <div class="toolbar">
          <input v-model="search" type="search" class="search" placeholder="Search name or email">
          <select v-model="typeFilter" class="filter">
            <option value="">All member types</option>
            <option v-for="t in memberTypes" :key="t" :value="t">{{ t }}</option>
          </select>
          <select v-model="cardFilter" class="filter">
            <option value="">Any card status</option>
            <option value="missing">Earned, cards not created</option>
            <option value="created">Has unpublished cards</option>
            <option value="printed">Has published cards to hand out</option>
            <option value="none">No cards</option>
          </select>
          <label class="toggle">
            <input v-model="earnersOnly" type="checkbox">
            Only earned or pending
          </label>
        </div>

        <!-- Bulk actions on the checked rows -->
        <div v-if="selectedRows.length" class="bulk-bar">
          <strong>{{ selectedRows.length }} selected</strong>
          <span class="small">{{ selectedCards.length ? statusSummary(selectedCards) : 'no cards yet' }}</span>
          <span class="spacer"></span>
          <RouterLink
            v-if="selectedCards.length"
            :to="{ name: 'voucher-print', query: { members: selectedRows.map(r => r.email).join(','), fy: fyStartYear } }"
            class="btn-secondary"
          >🖨️ Print their cards</RouterLink>
          <button v-if="selectedCards.some(v => v.status === 'created')" class="btn-secondary" @click="publishCards(selectedCards, `${selectedRows.length} members`)">✓ Publish</button>
          <button v-if="selectedCards.some(v => v.status === 'printed')" class="btn-secondary" @click="markHandedOut(selectedCards, `${selectedRows.length} members`)">✓ Mark handed out</button>
          <button class="btn-link" @click="selected = new Set()">Clear</button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="check">
                  <input type="checkbox" :checked="allShownSelected" :indeterminate.prop="someShownSelected" :disabled="!rows.length" title="Select all shown" @change="toggleAllShown">
                </th>
                <th class="sortable" @click="setSort('name')">Member{{ sortMark('name') }}</th>
                <th class="num sortable" @click="setSort('creditedHours')">Credited hrs{{ sortMark('creditedHours') }}</th>
                <th class="num sortable" @click="setSort('serviceVouchers')">Service{{ sortMark('serviceVouchers') }}</th>
                <th class="num sortable" @click="setSort('cleaningClockHours')">Cleaning hrs{{ sortMark('cleaningClockHours') }}</th>
                <th class="num sortable" @click="setSort('blueVouchers')">Blue Ribbon{{ sortMark('blueVouchers') }}</th>
                <th>Cards</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td colspan="7" class="empty">No members match.</td>
              </tr>
              <tr v-for="r in rows" :key="r.email" :class="{ selected: selected.has(r.email) }">
                <td class="check"><input type="checkbox" :checked="selected.has(r.email)" @change="toggleRow(r.email)"></td>
                <td>
                  <div class="name">{{ r.name }}</div>
                  <div class="meta">
                    <span v-if="r.type" class="type">{{ r.type }}</span>
                    <span v-if="r.eligibility === 'pending'" class="badge badge-pending">Pending vote-in</span>
                    <span v-else-if="r.eligibility === 'none'" class="badge badge-none">Not eligible</span>
                    <span v-if="!r.isMember" class="warn">not in members list</span>
                    <span v-else class="email">{{ r.email }}</span>
                  </div>
                </td>
                <td class="num">{{ fmt(r.creditedHours) }}</td>
                <td class="num strong" :class="{ dim: r.eligibility !== 'earns' }">{{ voucherCell(r, 'serviceVouchers') }}</td>
                <td class="num">{{ fmt(r.cleaningClockHours) }}</td>
                <td class="num strong blue-text" :class="{ dim: r.eligibility !== 'earns' }">{{ voucherCell(r, 'blueVouchers') }}</td>
                <td class="cards-cell">
                  <button v-if="memberCards(r.email).length" class="btn-link cards-link" @click="openMember(r)">
                    {{ statusSummary(memberCards(r.email)) }}
                  </button>
                  <span v-else class="small dim">—</span>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="rows.length > 0">
              <tr>
                <td></td>
                <td>Earned total ({{ rows.length }} shown; pending not included)</td>
                <td class="num">{{ fmt(sum('creditedHours')) }}</td>
                <td class="num strong">{{ sumEarned('serviceVouchers') }}</td>
                <td class="num">{{ fmt(sum('cleaningClockHours')) }}</td>
                <td class="num strong blue-text">{{ sumEarned('blueVouchers') }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </template>

    <!-- Issue vouchers: one modal, a tab per kind -->
    <BaseModal :open="issueOpen" title="Issue vouchers by hand" size="lg" persistent @close="issueOpen = false">
      <div class="tabs">
        <button v-for="(label, key) in ISSUE_TABS" :key="key" class="tab" :class="{ active: issueTab === key }" @click="issueTab = key">{{ label }}</button>
      </div>
      <!-- v-show keeps a half-filled form if you peek at another tab -->
      <TrialVoucherIssuer v-show="issueTab === 'trial'" :fiscal-year-options="fiscalYearOptions" :default-fiscal-year="currentFyStart" @issued="issueOpen = false" />
      <OneOffVoucherIssuer v-show="issueTab === 'oneoff'" :fiscal-year-options="fiscalYearOptions" :default-fiscal-year="currentFyStart" @issued="issueOpen = false" />
      <InstructorVoucherIssuer v-show="issueTab === 'instructor'" @issued="issueOpen = false" />
    </BaseModal>

    <!-- Who "Create cards" will make cards for -->
    <BaseModal :open="missingOpen" :title="`Cards to create · ${fyName(fyStartYear)}`" @close="missingOpen = false">
      <p class="small">
        {{ missingList.length }} member{{ missingList.length === 1 ? '' : 's' }} earned more vouchers than they have earned-from-hours cards for.
        "Create cards" adds just the difference. Hand-issued cards don't count toward this, and applicants pending a vote-in aren't included.
      </p>
      <table class="detail-table">
        <thead>
          <tr>
            <th>Member</th>
            <th class="num">Service<br><span class="th-sub">earned / have</span></th>
            <th class="num">Blue Ribbon<br><span class="th-sub">earned / have</span></th>
            <th class="num">To create</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in missingList" :key="m.email">
            <td>
              <div class="name">{{ m.name }}</div>
              <div class="meta"><span class="type">{{ m.type }}</span><span class="email">{{ m.email }}</span></div>
            </td>
            <td class="num">{{ m.earned.class }} / {{ m.have.class }}</td>
            <td class="num blue-text">{{ m.earned.blue }} / {{ m.have.blue }}</td>
            <td class="num strong">
              <span v-if="m.missing.class">{{ m.missing.class }} service</span>
              <span v-if="m.missing.class && m.missing.blue"> + </span>
              <span v-if="m.missing.blue" class="blue-text">{{ m.missing.blue }} Blue Ribbon</span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td></td>
            <td></td>
            <td class="num">{{ missingCards.class }} service + {{ missingCards.blue }} Blue Ribbon</td>
          </tr>
        </tfoot>
      </table>
      <template #footer>
        <button class="btn-secondary" @click="missingOpen = false">Close</button>
        <button class="btn-primary" :disabled="creating || !missingCards.total" @click="createEarnedCards">
          {{ creating ? 'Creating...' : `Create ${missingCards.total} cards` }}
        </button>
      </template>
    </BaseModal>

    <!-- One hand-issued set -->
    <BaseModal :open="Boolean(activeSet)" :title="activeSet?.label || ''" @close="activeSetKey = null">
      <template v-if="activeSet">
        <p class="small">
          <span v-if="activeSet.kind" class="badge badge-kind">{{ KIND_LABELS[activeSet.kind] || activeSet.kind }}</span>
          <span v-if="activeSet.fromWebsite" class="badge badge-web">from website</span>
          {{ statusSummary(activeSet.vouchers) }}<template v-if="activeSet.createdAt"> · issued {{ shortDate(activeSet.createdAt) }}</template><template v-if="activeSet.createdBy"> by {{ activeSet.createdBy }}</template>
        </p>
        <table class="detail-table">
          <thead>
            <tr><th>{{ activeSet.kind === 'instructor' ? 'Class' : 'Role' }}</th><th>Person</th><th>Type</th><th class="num">Cards</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="g in activeSet.rows" :key="g.key">
              <td>{{ g.role || '—' }}</td>
              <td>{{ g.memberName || '(write-in name)' }}</td>
              <td>{{ VOUCHER_TYPES[g.type].short }}</td>
              <td class="num">{{ g.vouchers.length }}</td>
              <td class="small">{{ statusWords(g.vouchers) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #footer>
        <template v-if="activeSet">
          <button v-if="activeSet.vouchers.every(v => v.status === 'created')" class="btn-danger" @click="deleteSet(activeSet)">Delete set</button>
          <span class="spacer"></span>
          <button v-if="activeSet.vouchers.some(v => v.status === 'created')" class="btn-secondary" @click="publishCards(activeSet.vouchers, activeSet.label)">✓ Publish</button>
          <RouterLink :to="{ name: 'voucher-print', query: { set: activeSet.key, fy: fyStartYear } }" class="btn-primary">🖨️ Print</RouterLink>
        </template>
      </template>
    </BaseModal>

    <!-- One member's cards -->
    <BaseModal :open="Boolean(activeMember)" :title="activeMember ? `${activeMember.name} · ${fyName(fyStartYear)} cards` : ''" @close="activeMemberEmail = null">
      <template v-if="activeMember">
        <table class="detail-table">
          <thead>
            <tr><th>Code</th><th>Type</th><th>From</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="v in activeMemberCards" :key="v.code">
              <td class="code">{{ v.code }}</td>
              <td>{{ VOUCHER_TYPES[v.type].short }}</td>
              <td class="small">{{ v.source === 'manual' ? (v.reason || 'Issued by hand') : 'Earned from hours' }}</td>
              <td>
                <span class="status-pill" :class="'pill-' + v.status">{{ STATUS_LABELS[v.status] }}</span>
                <span v-if="v.status === 'used' && v.usedBy" class="small"> by {{ v.usedBy }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #footer>
        <template v-if="activeMember">
          <button v-if="activeMemberCards.some(v => v.status === 'created')" class="btn-secondary" @click="publishCards(activeMemberCards, activeMember.name)">✓ Publish</button>
          <button v-if="activeMemberCards.some(v => v.status === 'printed')" class="btn-secondary" @click="markHandedOut(activeMemberCards, activeMember.name)">✓ Mark handed out</button>
          <RouterLink :to="{ name: 'voucher-print', query: { members: activeMember.email, fy: fyStartYear } }" class="btn-primary">🖨️ Print</RouterLink>
        </template>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import Papa from 'papaparse'
import { useMembersStore } from '@/stores/membersStore'
import { useLogsStore } from '@/stores/logsStore'
import { useVouchersStore, VOUCHER_TYPES, STATUS_LABELS } from '@/stores/vouchersStore'
import BaseModal from '@/components/shared/BaseModal.vue'
import TrialVoucherIssuer from './components/TrialVoucherIssuer.vue'
import InstructorVoucherIssuer from './components/InstructorVoucherIssuer.vue'
import OneOffVoucherIssuer from './components/OneOffVoucherIssuer.vue'
import { voucherTotalsByMember, voucherEligibility } from '@/utils/vouchers'

const membersStore = useMembersStore()
const logsStore = useLogsStore()
const vouchersStore = useVouchersStore()
const loading = ref(true)
const isDev = import.meta.env.DEV

onMounted(async () => {
  await Promise.all([membersStore.initMembers(), logsStore.initLogs(), vouchersStore.initVouchers()])
  loading.value = false
})

const STATUS_ORDER = ['created', 'printed', 'handed_out', 'used']
const KIND_LABELS = { trial: 'Trial', oneoff: 'One-off', instructor: 'Instructors' }
const ISSUE_TABS = { trial: 'Trial workers', oneoff: 'One-off (board, thank-yous)', instructor: 'Instructors (registrar CSV)' }

// Fiscal years are identified by their starting calendar year; FY26 = Oct 2025 - Sep 2026
const fyName = (startYear) => `FY${String(startYear + 1).slice(-2)}`
const today = new Date()
const currentFyStart = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1

// Default to the most recently completed fiscal year
const fyStartYear = ref(currentFyStart - 1)

const fiscalYearOptions = computed(() => {
  const years = new Set([currentFyStart, currentFyStart - 1])
  logsStore.logs.forEach(log => {
    const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date)
    if (!isNaN(d)) years.add(d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1)
  })
  return [...years].sort((a, b) => b - a)
})

const allRows = computed(() => {
  const totals = voucherTotalsByMember(logsStore.logs, fyStartYear.value)
  return Object.entries(totals).map(([email, t]) => {
    const member = membersStore.getMemberByEmail(email)
    return {
      email,
      isMember: Boolean(member),
      name: member ? `${member.LastName || ''}, ${member.FirstName || ''}` : email,
      type: member?.MembershipType || '',
      eligibility: voucherEligibility(member?.MembershipType),
      ...t
    }
  })
})

// The count the hours would earn; shown as "(n)" when pending and "—" when not eligible
const voucherCell = (r, key) => {
  if (r.eligibility === 'earns') return r[key]
  if (r.eligibility === 'pending') return r[key] ? `(${r[key]})` : 0
  return '—'
}

const earnedRows = computed(() => allRows.value.filter(r => r.eligibility === 'earns'))
const pendingRows = computed(() => allRows.value.filter(r => r.eligibility === 'pending'))

const totals = computed(() => ({
  service: earnedRows.value.reduce((s, r) => s + r.serviceVouchers, 0),
  blue: earnedRows.value.reduce((s, r) => s + r.blueVouchers, 0),
  earners: earnedRows.value.filter(r => r.serviceVouchers + r.blueVouchers > 0).length,
  pendingService: pendingRows.value.reduce((s, r) => s + r.serviceVouchers, 0),
  pendingBlue: pendingRows.value.reduce((s, r) => s + r.blueVouchers, 0),
  pendingPeople: pendingRows.value.filter(r => r.serviceVouchers + r.blueVouchers > 0).length,
  logged: allRows.value.length
}))

const fmt = (n) => Math.round(n * 100) / 100
const shortDate = (ts) => (ts?.toDate ? ts.toDate() : new Date(ts)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

// --- Voucher cards ---

const fyVouchers = computed(() => vouchersStore.vouchers.filter(v => v.fiscalYear === fyStartYear.value))

const cardsByEmail = computed(() => {
  const map = {}
  fyVouchers.value.forEach(v => { (map[v.memberEmail] ||= []).push(v) })
  return map
})
const memberCards = (email) => cardsByEmail.value[email] || []

const ledger = computed(() => {
  const counts = { class: { total: 0, created: 0, printed: 0, handed_out: 0, used: 0 }, blue: { total: 0, created: 0, printed: 0, handed_out: 0, used: 0 } }
  fyVouchers.value.forEach(v => {
    const c = counts[v.type]
    if (!c) return
    c.total++
    c[v.status] = (c[v.status] || 0) + 1
  })
  return counts
})

const statusWords = (vouchers) => {
  const counts = {}
  vouchers.forEach(v => { counts[v.status] = (counts[v.status] || 0) + 1 })
  return STATUS_ORDER.filter(s => counts[s]).map(s => `${counts[s]} ${STATUS_LABELS[s]}`).join(', ')
}
const statusSummary = (vouchers) => `${vouchers.length} card${vouchers.length === 1 ? '' : 's'}: ${statusWords(vouchers)}`

// What eligible members' hours earn, as card counts
const earnedForCards = computed(() => allRows.value
  .filter(r => r.eligibility === 'earns' && r.isMember)
  .map(r => {
    const m = membersStore.getMemberByEmail(r.email)
    return {
      memberEmail: r.email,
      memberName: `${m.FirstName || ''} ${m.LastName || ''}`.trim(),
      class: r.serviceVouchers,
      blue: r.blueVouchers
    }
  }))

const earnedCardCounts = computed(() => vouchersStore.countsByMember(fyStartYear.value, 'earned'))
const missingFor = (e) => ['class', 'blue'].reduce((n, type) => n + Math.max(0, e[type] - (earnedCardCounts.value[e.memberEmail]?.[type]?.total || 0)), 0)

const missingCards = computed(() => {
  const missing = { class: 0, blue: 0 }
  earnedForCards.value.forEach(e => {
    for (const type of ['class', 'blue']) {
      missing[type] += Math.max(0, e[type] - (earnedCardCounts.value[e.memberEmail]?.[type]?.total || 0))
    }
  })
  return { ...missing, total: missing.class + missing.blue }
})
const missingEmails = computed(() => new Set(earnedForCards.value.filter(e => missingFor(e) > 0).map(e => e.memberEmail)))

// Per member, for the "See who" modal: earned vs. existing earned cards, by type
const missingOpen = ref(false)
const missingList = computed(() => earnedForCards.value
  .filter(e => missingFor(e) > 0)
  .map(e => {
    const row = allRows.value.find(r => r.email === e.memberEmail)
    const have = { class: earnedCardCounts.value[e.memberEmail]?.class?.total || 0, blue: earnedCardCounts.value[e.memberEmail]?.blue?.total || 0 }
    return {
      email: e.memberEmail,
      name: row?.name || e.memberName,
      type: row?.type || '',
      earned: { class: e.class, blue: e.blue },
      have,
      missing: { class: Math.max(0, e.class - have.class), blue: Math.max(0, e.blue - have.blue) }
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name)))

const creating = ref(false)

const createEarnedCards = async () => {
  const { class: c, blue: b } = missingCards.value
  if (!confirm(`Create ${c} service and ${b} Blue Ribbon voucher cards for ${fyName(fyStartYear.value)}?`)) return
  creating.value = true
  try {
    const n = await vouchersStore.syncEarnedVouchers(fyStartYear.value, earnedForCards.value)
    missingOpen.value = false
    alert(`Created ${n} voucher cards. Use "Print cards" to print them.`)
  } catch (e) {
    alert('Could not create voucher cards: ' + e.message)
  } finally {
    creating.value = false
  }
}

const unprintedEarned = computed(() => fyVouchers.value.filter(v => v.source === 'earned' && v.status === 'created'))
const resetting = ref(false)

const devResetEarnedCards = async () => {
  const n = unprintedEarned.value.length
  if (!confirm(`DEV: Permanently delete ${n} unprinted earned voucher cards for ${fyName(fyStartYear.value)}? Their codes will be gone; run "Create cards" afterwards to regenerate.`)) return
  resetting.value = true
  try {
    const deleted = await vouchersStore.devResetUnprintedEarned(fyStartYear.value)
    alert(`Deleted ${deleted} cards.`)
  } catch (e) {
    alert('Could not reset cards: ' + e.message)
  } finally {
    resetting.value = false
  }
}

// Release unpublished cards to members (stored status 'printed' = Published) without printing them here
const publishCards = async (vouchers, label) => {
  const unpublished = vouchers.filter(v => v.status === 'created')
  if (!confirm(`Publish ${unpublished.length} card${unpublished.length === 1 ? '' : 's'} for ${label}? Members will see them on the website, and they can't be deleted after this.`)) return
  try {
    await vouchersStore.setStatus(unpublished, 'printed')
  } catch (e) {
    alert('Could not publish: ' + e.message)
  }
}

// Only published cards move to handed out - never knock a used card back
const markHandedOut = async (vouchers, label) => {
  const published = vouchers.filter(v => v.status === 'printed')
  if (published.length > 1 && !confirm(`Mark ${published.length} published cards for ${label} as handed out?`)) return
  try {
    await vouchersStore.setStatus(published, 'handed_out')
  } catch (e) {
    alert('Could not update vouchers: ' + e.message)
  }
}

// --- Issue modal ---

const issueOpen = ref(false)
const issueTab = ref('trial')
const openIssue = (tab) => { issueTab.value = tab; issueOpen.value = true }

// --- Hand-issued sets ---

// Vouchers issued by hand (trial workers, instructors, one-offs), grouped into their sets. Older one-off
// manual vouchers without a set fall back to grouping by their reason.
const manualSets = computed(() => {
  const sets = {}
  fyVouchers.value.filter(v => v.source === 'manual').forEach(v => {
    const setKey = v.set?.setId || `reason|${v.reason}`
    const s = (sets[setKey] ||= {
      key: setKey,
      label: v.set?.label || v.reason || 'Issued by hand',
      kind: v.set?.kind || '',
      fromWebsite: v.set?.issuedFrom === 'website',
      createdBy: v.createdBy || '',
      createdAt: null,
      vouchers: [],
      rowMap: {}
    })
    s.vouchers.push(v)
    const ms = v.createdAt?.toMillis ? v.createdAt.toMillis() : 0
    if (ms > (s.createdAt?.toMillis?.() || 0)) s.createdAt = v.createdAt
    const role = v.set?.role || ''
    const rowKey = `${role}|${v.memberEmail || v.memberName}|${v.type}`
    ;(s.rowMap[rowKey] ||= { key: rowKey, role, memberName: v.memberName, type: v.type, vouchers: [] }).vouchers.push(v)
  })
  return Object.values(sets)
    .map(s => ({
      ...s,
      rows: Object.values(s.rowMap).sort((a, b) => a.role.localeCompare(b.role) || (a.memberName || '').localeCompare(b.memberName || '')),
      people: new Set(s.vouchers.map(v => v.memberEmail || v.memberName || v.code)).size
    }))
    // Newest first - the list only grows, and the recent sets are the ones still being worked on
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0) || a.label.localeCompare(b.label))
})

const SETS_COLLAPSED = 5
const setsExpanded = ref(false)
const setSearch = ref('')
const setsNeedPublishing = ref(false)

const filteredSets = computed(() => {
  const term = setSearch.value.trim().toLowerCase()
  return manualSets.value.filter(s => {
    if (setsNeedPublishing.value && !s.vouchers.some(v => v.status === 'created')) return false
    return !term || s.label.toLowerCase().includes(term) ||
      s.rows.some(r => (r.memberName || '').toLowerCase().includes(term) || r.role.toLowerCase().includes(term))
  })
})
// Searching shows every match; otherwise just the newest few until expanded
const visibleSets = computed(() =>
  setsExpanded.value || setSearch.value.trim() ? filteredSets.value : filteredSets.value.slice(0, SETS_COLLAPSED))

const activeSetKey = ref(null)
const activeSet = computed(() => manualSets.value.find(s => s.key === activeSetKey.value) || null)
const openSet = (key) => { activeSetKey.value = key }

// Only allowed while nothing in the set has been published
const deleteSet = async (s) => {
  if (!confirm(`Delete all ${s.vouchers.length} unpublished vouchers for ${s.label}?`)) return
  try {
    for (const v of s.vouchers) await vouchersStore.deleteUnprintedVoucher(v.code)
    activeSetKey.value = null
  } catch (e) {
    alert('Could not delete: ' + e.message)
  }
}

// --- Members table ---

const search = ref('')
const typeFilter = ref('')
const cardFilter = ref('')
const earnersOnly = ref(true)
const sortKey = ref('serviceVouchers')
const sortDesc = ref(true)

const memberTypes = computed(() => [...new Set(allRows.value.map(r => r.type).filter(Boolean))].sort())

const setSort = (key) => {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value
  else { sortKey.value = key; sortDesc.value = key !== 'name' }
}
const sortMark = (key) => sortKey.value === key ? (sortDesc.value ? ' ▼' : ' ▲') : ''

const matchesCardFilter = (r) => {
  const cards = memberCards(r.email)
  switch (cardFilter.value) {
    case 'missing': return missingEmails.value.has(r.email)
    case 'created': return cards.some(v => v.status === 'created')
    case 'printed': return cards.some(v => v.status === 'printed')
    case 'none': return cards.length === 0
    default: return true
  }
}

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = allRows.value.filter(r => {
    if (earnersOnly.value && (r.eligibility === 'none' || r.serviceVouchers + r.blueVouchers === 0)) return false
    if (typeFilter.value && r.type !== typeFilter.value) return false
    if (!matchesCardFilter(r)) return false
    return !term || r.name.toLowerCase().includes(term) || r.email.includes(term)
  })
  const dir = sortDesc.value ? -1 : 1
  return list.sort((a, b) => {
    const av = a[sortKey.value], bv = b[sortKey.value]
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return cmp * dir || a.name.localeCompare(b.name)
  })
})

const sum = (key) => rows.value.reduce((s, r) => s + r[key], 0)
const sumEarned = (key) => rows.value.filter(r => r.eligibility === 'earns').reduce((s, r) => s + r[key], 0)

// Checked rows, by email. Rows hidden by a filter stay checked but bulk actions only use the shown ones.
const selected = ref(new Set())
watch(fyStartYear, () => { selected.value = new Set() })

const toggleRow = (email) => {
  const next = new Set(selected.value)
  next.has(email) ? next.delete(email) : next.add(email)
  selected.value = next
}
const selectedRows = computed(() => rows.value.filter(r => selected.value.has(r.email)))
const selectedCards = computed(() => selectedRows.value.flatMap(r => memberCards(r.email)))
const allShownSelected = computed(() => rows.value.length > 0 && selectedRows.value.length === rows.value.length)
const someShownSelected = computed(() => selectedRows.value.length > 0 && !allShownSelected.value)
const toggleAllShown = () => {
  const next = new Set(selected.value)
  if (allShownSelected.value) rows.value.forEach(r => next.delete(r.email))
  else rows.value.forEach(r => next.add(r.email))
  selected.value = next
}

const activeMemberEmail = ref(null)
const activeMember = computed(() => allRows.value.find(r => r.email === activeMemberEmail.value) || null)
const activeMemberCards = computed(() => activeMember.value
  ? [...memberCards(activeMember.value.email)].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.type.localeCompare(b.type))
  : [])
const openMember = (r) => { activeMemberEmail.value = r.email }

const exportCsv = () => {
  const csv = Papa.unparse(rows.value.map(r => ({
    FiscalYear: fyName(fyStartYear.value),
    Name: r.name,
    Email: r.email,
    MembershipType: r.type,
    VoucherStatus: { earns: 'Earned', pending: 'Pending vote-in', none: 'Not eligible' }[r.eligibility],
    CreditedHours: fmt(r.creditedHours),
    ServiceVouchers: r.eligibility === 'none' ? 0 : r.serviceVouchers,
    CleaningClockHours: fmt(r.cleaningClockHours),
    BlueVouchers: r.eligibility === 'none' ? 0 : r.blueVouchers
  })))
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `vouchers_${fyName(fyStartYear.value)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.vouchers-view {
  max-width: 1000px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.page-header h1 { margin: 0; font-size: 1.75rem; font-weight: 800; }
.subtitle { margin: 0.25rem 0 0; color: #6b7280; max-width: 560px; }
.header-actions { display: flex; align-items: flex-end; gap: 0.6rem; flex-wrap: wrap; }

.fy-select { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; font-weight: 700; color: #6b7280; text-transform: uppercase; }
.fy-select select { padding: 0.45rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 1rem; font-weight: 600; color: #111827; }

.loading { color: #6b7280; font-style: italic; }
.error { color: #b91c1c; font-weight: 600; font-size: 0.9rem; }

/* --- At a glance --- */
.glance {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.tile {
  background: white;
  border: 1px solid #e5e7eb;
  border-left: 4px solid #4f46e5;
  border-radius: 0.5rem;
  padding: 0.7rem 0.9rem;
}
.tile.blue { border-left-color: #2563eb; }
.tile.pending { border-left-color: #d97706; }
.tile-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #6b7280; }
.tile-main { font-size: 1.5rem; font-weight: 800; margin: 0.1rem 0 0.3rem; }
.tile-main small { font-size: 0.8rem; font-weight: 600; color: #6b7280; }
.tile-sub { font-size: 0.78rem; color: #4b5563; display: flex; flex-wrap: wrap; gap: 0.15rem 0.7rem; }

/* Card status as one stacked bar: unpublished -> published -> handed out -> used */
.status-bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: #f1f5f9; margin-bottom: 0.4rem; }
.legend { display: inline-flex; align-items: center; gap: 0.25rem; }
.legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
.seg-created { background: #cbd5e1; }
.seg-printed { background: #818cf8; }
.seg-handed_out { background: #22c55e; }
.seg-used { background: #374151; }

.callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 0.5rem;
  padding: 0.7rem 0.9rem;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
}
.callout .hint { display: block; }
.callout-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.th-sub { font-weight: 500; text-transform: none; color: #9ca3af; }
.all-set { margin: 0 0 1.25rem; font-size: 0.85rem; color: #15803d; font-weight: 600; }
.hint { font-size: 0.8rem; color: #6b7280; }

.dev-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
.dev-reset-btn {
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  border-radius: 0.375rem;
  border: 1px dashed #dc2626;
  background: #fef2f2;
  color: #b91c1c;
  font-weight: bold;
  cursor: pointer;
}
.dev-reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* --- Panels --- */
.panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.6rem;
  padding: 1rem;
  margin-bottom: 1.25rem;
}
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.panel-head h2 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; }
.panel-tools { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.count { font-size: 0.75rem; font-weight: 700; background: #f3f4f6; color: #4b5563; border-radius: 999px; padding: 0.05rem 0.5rem; }
.empty-note { color: #6b7280; font-size: 0.9rem; margin: 0; }

.btn-primary { background: #4f46e5; color: white; border: none; padding: 0.5rem 0.9rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; text-decoration: none; font-size: 0.9rem; }
.btn-primary:disabled { background: #a5b4fc; cursor: not-allowed; }
.btn-secondary { border: 1px solid #cbd5e1; background: white; color: #1f2937; padding: 0.45rem 0.8rem; border-radius: 0.375rem; font-weight: 600; text-decoration: none; font-size: 0.9rem; cursor: pointer; }
.btn-secondary:disabled { color: #9ca3af; cursor: not-allowed; }
.btn-danger { border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c; padding: 0.45rem 0.8rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
.btn-link { background: none; border: none; color: #4f46e5; font-weight: 600; cursor: pointer; padding: 0; font-size: 0.8rem; text-decoration: none; }
.spacer { flex: 1; }

/* --- Hand-issued sets --- */
.set-list { list-style: none; margin: 0; padding: 0; border: 1px solid #e5e7eb; border-radius: 0.5rem; }
.set-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; }
.set-row:last-child { border-bottom: none; }
.set-row:hover { background: #f9fafb; }
.set-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: inherit; }
.set-title { font-weight: 600; display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.row-actions { display: flex; gap: 0.75rem; white-space: nowrap; }
.show-more { margin-top: 0.5rem; background: none; border: none; color: #4f46e5; font-weight: 600; cursor: pointer; font-size: 0.85rem; padding: 0; }

.badge { font-size: 0.68rem; font-weight: 700; padding: 0 0.4rem; border-radius: 999px; }
.badge-pending { background: #fef3c7; color: #92400e; }
.badge-web { background: #e0e7ff; color: #3730a3; }
.badge-kind { background: #f3f4f6; color: #374151; }
.badge-none { background: #f3f4f6; color: #6b7280; }
.dim { color: #9ca3af !important; font-weight: 500; }
.small { font-size: 0.78rem; color: #4b5563; }

/* --- Members table --- */
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
.search { flex: 1; min-width: 180px; padding: 0.5rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; }
.small-search { flex: 0 1 220px; padding: 0.35rem 0.5rem; font-size: 0.85rem; }
.filter { padding: 0.45rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.85rem; }
.toggle { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; cursor: pointer; }

.bulk-bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
}

.table-wrap { border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f1f5f9; text-align: left; }
th { font-size: 0.72rem; text-transform: uppercase; color: #6b7280; background: #f9fafb; white-space: nowrap; }
.check { width: 1.5rem; padding-right: 0; }
tr.selected td { background: #f5f7ff; }
.sortable { cursor: pointer; user-select: none; }
.num { text-align: right; }
.strong { font-weight: 700; }
.blue-text { color: #1d4ed8; }
.name { font-weight: 600; }
.meta { display: flex; gap: 0.5rem; font-size: 0.75rem; color: #6b7280; }
.type { font-weight: 700; text-transform: uppercase; }
.warn { color: #b45309; font-weight: 600; }
.email { word-break: break-all; }
.empty { text-align: center; color: #6b7280; font-style: italic; }
.cards-cell { min-width: 150px; }
.cards-link { text-align: left; font-weight: 500; }
tfoot td { font-weight: 700; background: #f9fafb; border-top: 2px solid #e5e7eb; }

/* --- Modals --- */
.tabs { display: flex; flex-wrap: wrap; gap: 0.25rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 1rem; }
.tab { background: none; border: none; border-bottom: 3px solid transparent; padding: 0.5rem 0.8rem; font-weight: 600; color: #6b7280; cursor: pointer; font-size: 0.9rem; }
.tab.active { color: #4f46e5; border-bottom-color: #4f46e5; }

.detail-table { font-size: 0.85rem; margin-top: 0.5rem; }
.detail-table th, .detail-table td { padding: 0.4rem 0.6rem; }
.code { font-family: 'Courier New', monospace; font-weight: 700; letter-spacing: 0.06em; }
.status-pill { font-size: 0.72rem; font-weight: 700; padding: 0.05rem 0.5rem; border-radius: 999px; }
.pill-created { background: #f1f5f9; color: #475569; }
.pill-printed { background: #e0e7ff; color: #3730a3; }
.pill-handed_out { background: #dcfce7; color: #166534; }
.pill-used { background: #e5e7eb; color: #111827; }
</style>
