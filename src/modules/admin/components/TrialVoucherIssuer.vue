<template>
  <form class="trial-issuer" @submit.prevent="issue">
    <div class="trial-fields">
      <div class="field">
        <label>Trial type</label>
        <input v-model="trialType" list="trial-type-presets" type="text" placeholder="e.g. Agility" @change="applyPreset">
        <datalist id="trial-type-presets">
          <option v-for="name in Object.keys(TRIAL_PRESETS)" :key="name" :value="name"></option>
        </datalist>
      </div>
      <div class="field">
        <label>Trial dates</label>
        <input v-model="trialDates" type="text" placeholder="e.g. Mar 6-8, 2027">
      </div>
      <div class="field narrow">
        <label>Days</label>
        <input v-model.number="days" type="number" min="1" max="10">
      </div>
      <div class="field">
        <label>Voucher type</label>
        <select v-model="voucherType">
          <option value="class">Service</option>
          <option value="blue">Blue Ribbon</option>
        </select>
      </div>
      <div class="field narrow">
        <label>Fiscal year</label>
        <select v-model.number="fiscalYear">
          <option v-for="y in fiscalYearOptions" :key="y" :value="y">{{ fyLabel(y) }}</option>
        </select>
      </div>
    </div>

    <table class="roles-table">
      <thead>
        <tr>
          <th>Role</th>
          <th>Person</th>
          <th class="num">Per day</th>
          <th class="num">Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in roles" :key="row.id">
          <td><input v-model="row.role" type="text" class="cell-input" placeholder="Role"></td>
          <td class="person"><MemberSelect v-model="row.memberEmail" /></td>
          <td class="num"><input v-model.number="row.perDay" type="number" min="0" max="20" class="cell-input num-input"></td>
          <td class="num strong">{{ rowTotal(row) }}</td>
          <td><button type="button" class="remove" title="Remove role" @click="roles.splice(i, 1)">×</button></td>
        </tr>
        <tr v-if="roles.length === 0">
          <td colspan="5" class="empty">Pick a trial type above, or add roles.</td>
        </tr>
      </tbody>
    </table>

    <div class="issuer-actions">
      <button type="button" class="btn-secondary" @click="addRole">+ Add role</button>
      <span class="summary">
        {{ totalVouchers }} voucher{{ totalVouchers === 1 ? '' : 's' }} across {{ readyRows.length }}
        role{{ readyRows.length === 1 ? '' : 's' }}
        <span v-if="unassigned" class="note">· {{ unassigned }} role{{ unassigned === 1 ? '' : 's' }} without a person will print with a blank name line</span>
      </span>
      <button type="submit" class="btn-primary" :disabled="!canIssue || issuing">
        {{ issuing ? 'Issuing...' : 'Issue trial vouchers' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMembersStore } from '@/stores/membersStore'
import { useVouchersStore, fyLabel } from '@/stores/vouchersStore'
import MemberSelect from '@/components/admin/MemberSelect.vue'

const props = defineProps({ fiscalYearOptions: { type: Array, required: true }, defaultFiscalYear: { type: Number, required: true } })
// 'issued' after a successful issue, so a surrounding modal can close
const emit = defineEmits(['issued'])

// Vouchers per trial day, by role. Editable on the form; these are just the starting points.
const STANDARD_TRIAL_ROLES = [
  ['Secretary', 2],
  ['Chair', 1],
  ['Scheduler', 1],
  ['Ring Steward/Worker Coordinator', 1],
  ['Food Chair', 1],
  ['Chief Course Builder', 1]
]
const TRIAL_PRESETS = {
  Agility: STANDARD_TRIAL_ROLES,
  Obedience: STANDARD_TRIAL_ROLES,
  Conformation: STANDARD_TRIAL_ROLES,
  'Barn Hunt': [
    ['Pre-Trial Secretary', 1],
    ['Trial Secretary', 1],
    ['Chair', 1],
    ['Food Chair', 1],
    ['Volunteer Appreciation', 2],
    ['Blind Steward', 1]
  ]
}

const membersStore = useMembersStore()
const vouchersStore = useVouchersStore()

const trialType = ref('')
const trialDates = ref('')
const days = ref(1)
// Trial workers get Blue Ribbon vouchers; still switchable per trial
const voucherType = ref('blue')
const fiscalYear = ref(props.defaultFiscalYear)
const roles = ref([])

let nextId = 0
const makeRole = (role = '', perDay = 1) => ({ id: nextId++, role, perDay, memberEmail: '' })

// Picking a preset trial type loads its roles - only if no one has been assigned yet, so a typo
// fix doesn't wipe out a filled-in form
const applyPreset = () => {
  const preset = Object.entries(TRIAL_PRESETS).find(([name]) => name.toLowerCase() === trialType.value.trim().toLowerCase())
  if (!preset) return
  if (roles.value.some(r => r.memberEmail) && !confirm(`Replace the roles with the ${preset[0]} defaults?`)) return
  trialType.value = preset[0]
  roles.value = preset[1].map(([role, perDay]) => makeRole(role, perDay))
}

const addRole = () => roles.value.push(makeRole('', 1))

const rowTotal = (row) => Math.max(0, Number(row.perDay) || 0) * Math.max(0, Number(days.value) || 0)

// Roles without a person still get vouchers - the cards print with a blank line to write a name on
const readyRows = computed(() => roles.value.filter(r => r.role.trim() && rowTotal(r) > 0))
const unassigned = computed(() => readyRows.value.filter(r => !r.memberEmail).length)
const totalVouchers = computed(() => readyRows.value.reduce((s, r) => s + rowTotal(r), 0))
const canIssue = computed(() => trialType.value.trim() && trialDates.value.trim() && readyRows.value.length > 0)

const issuing = ref(false)

const issue = async () => {
  const label = `${trialType.value.trim()} ${trialDates.value.trim()}`
  if (!confirm(`Issue ${totalVouchers.value} ${voucherType.value === 'class' ? 'service' : 'Blue Ribbon'} vouchers for the ${label} trial?`)) return

  const setId = `trial-${Date.now()}`
  const specs = []
  for (const row of readyRows.value) {
    const m = row.memberEmail ? membersStore.getMemberByEmail(row.memberEmail) : null
    const role = row.role.trim()
    for (let n = 0; n < rowTotal(row); n++) {
      specs.push({
        type: voucherType.value,
        source: 'manual',
        fiscalYear: fiscalYear.value,
        // Blank when no one is assigned yet - the card gets a write-in line
        memberEmail: m ? m.Email.toLowerCase() : '',
        memberName: m ? `${m.FirstName || ''} ${m.LastName || ''}`.trim() : '',
        reason: `${label} · ${role}`,
        set: { kind: 'trial', setId, label, trialType: trialType.value.trim(), trialDates: trialDates.value.trim(), role, days: days.value, perDay: row.perDay }
      })
    }
  }

  issuing.value = true
  try {
    const n = await vouchersStore.createVouchers(specs)
    alert(`Issued ${n} vouchers for the ${label} trial. Print them from "Print cards" (Issued by hand).`)
    trialType.value = ''
    trialDates.value = ''
    days.value = 1
    roles.value = []
    emit('issued')
  } catch (e) {
    alert('Could not issue vouchers: ' + e.message)
  } finally {
    issuing.value = false
  }
}
</script>

<style scoped>
.trial-issuer { margin-top: 0.75rem; }

.trial-fields { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 150px; }
.field.narrow { flex: 0 0 90px; min-width: 90px; }
.field label { font-size: 0.75rem; font-weight: 600; color: #4b5563; }
.field input, .field select { padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; }

.roles-table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.875rem; }
.roles-table th { font-size: 0.72rem; text-transform: uppercase; color: #6b7280; text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #e5e7eb; }
.roles-table td { padding: 0.3rem 0.4rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.person { min-width: 220px; }
.num { text-align: right; }
.strong { font-weight: 700; }
.cell-input { width: 100%; padding: 0.35rem; border: 1px solid #e5e7eb; border-radius: 0.25rem; font-size: 0.875rem; box-sizing: border-box; }
.num-input { width: 4rem; text-align: center; }
.remove { background: none; border: none; color: #9ca3af; font-size: 1.25rem; cursor: pointer; }
.remove:hover { color: #dc2626; }
.empty { text-align: center; color: #6b7280; font-style: italic; }

.issuer-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin-top: 0.75rem; }
.summary { flex: 1; font-size: 0.875rem; color: #374151; }
.note { color: #4b5563; font-style: italic; }
.btn-primary { background: #4f46e5; color: white; border: none; padding: 0.5rem 0.9rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { background: #a5b4fc; cursor: not-allowed; }
.btn-secondary { border: 1px solid #cbd5e1; background: white; color: #1f2937; padding: 0.45rem 0.8rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; }
</style>
