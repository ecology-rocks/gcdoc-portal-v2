<template>
  <form class="oneoff-issuer" @submit.prevent="issue">
    <div class="oneoff-fields">
      <div class="field">
        <label>Reason (printed on the card)</label>
        <input v-model="reason" list="oneoff-reason-presets" type="text" placeholder="e.g. Board Service" @change="applyPreset">
        <datalist id="oneoff-reason-presets">
          <option v-for="name in Object.keys(REASON_PRESETS)" :key="name" :value="name"></option>
        </datalist>
      </div>
      <div class="field">
        <label>Voucher type</label>
        <select v-model="voucherType">
          <option value="class">Service</option>
          <option value="blue">Blue Ribbon</option>
        </select>
      </div>
      <div class="field narrow">
        <label>Each</label>
        <input v-model.number="perPerson" type="number" min="1" max="20" @change="applyPerPerson">
      </div>
      <div class="field narrow">
        <label>Fiscal year</label>
        <select v-model.number="fiscalYear">
          <option v-for="y in fiscalYearOptions" :key="y" :value="y">{{ fyLabel(y) }}</option>
        </select>
      </div>
    </div>

    <table class="people-table">
      <thead>
        <tr>
          <th>Person</th>
          <th class="num">Vouchers</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="row.id">
          <td class="person">
            <MemberSelect v-model="row.memberEmail" />
            <div v-if="rowWarning(row)" class="row-warn">{{ rowWarning(row) }}</div>
          </td>
          <td class="num"><input v-model.number="row.count" type="number" min="0" max="20" class="cell-input num-input"></td>
          <td><button type="button" class="remove" title="Remove" @click="rows.splice(i, 1)">×</button></td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="3" class="empty">Add people below.</td>
        </tr>
      </tbody>
    </table>

    <div class="issuer-actions">
      <button type="button" class="btn-secondary" @click="addRow">+ Add person</button>
      <span class="summary">
        {{ totalVouchers }} voucher{{ totalVouchers === 1 ? '' : 's' }} for {{ readyRows.length }}
        {{ readyRows.length === 1 ? 'person' : 'people' }}
        <span v-if="unassigned" class="note">· {{ unassigned }} without a name will print with a blank name line</span>
      </span>
      <button type="submit" class="btn-primary" :disabled="!canIssue || issuing">
        {{ issuing ? 'Issuing...' : 'Issue vouchers' }}
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

// Picking a preset reason sets its voucher type and count. Board members who attend at least
// 2/3 of the year's meetings get 5 Blue Ribbon vouchers, once a year.
const REASON_PRESETS = {
  'Board Service': { type: 'blue', perPerson: 5 }
}

const membersStore = useMembersStore()
const vouchersStore = useVouchersStore()

const reason = ref('')
const voucherType = ref('blue')
const perPerson = ref(1)
const fiscalYear = ref(props.defaultFiscalYear)

let nextId = 0
const makeRow = () => ({ id: nextId++, memberEmail: '', count: perPerson.value })
const rows = ref([makeRow()])

const addRow = () => rows.value.push(makeRow())

const applyPreset = () => {
  const preset = Object.entries(REASON_PRESETS).find(([name]) => name.toLowerCase() === reason.value.trim().toLowerCase())
  if (!preset) return
  reason.value = preset[0]
  voucherType.value = preset[1].type
  perPerson.value = preset[1].perPerson
  applyPerPerson()
}

// Changing "Each" resets every row's count to it
const applyPerPerson = () => rows.value.forEach(r => { r.count = perPerson.value })

const rowCount = (row) => Math.max(0, Number(row.count) || 0)

// Rows without a person still get vouchers - the cards print with a blank line to write a name on
const readyRows = computed(() => rows.value.filter(r => rowCount(r) > 0))
const unassigned = computed(() => readyRows.value.filter(r => !r.memberEmail).length)
const totalVouchers = computed(() => readyRows.value.reduce((s, r) => s + rowCount(r), 0))
const canIssue = computed(() => reason.value.trim() && readyRows.value.length > 0)

// Catch the same person twice on the form, or already given vouchers for this reason this year
const rowWarning = (row) => {
  const email = (row.memberEmail || '').toLowerCase()
  if (!email) return ''
  if (rows.value.filter(r => (r.memberEmail || '').toLowerCase() === email).length > 1) return 'Listed more than once'
  const why = reason.value.trim().toLowerCase()
  const already = why && vouchersStore.vouchers.filter(v =>
    v.source === 'manual' && v.fiscalYear === fiscalYear.value && v.memberEmail === email &&
    (v.set?.label || v.reason || '').toLowerCase() === why).length
  return already ? `Already has ${already} "${reason.value.trim()}" voucher${already === 1 ? '' : 's'} for ${fyLabel(fiscalYear.value)}` : ''
}

const issuing = ref(false)

const issue = async () => {
  const label = reason.value.trim()
  const kind = voucherType.value === 'class' ? 'service' : 'Blue Ribbon'
  if (!confirm(`Issue ${totalVouchers.value} ${kind} vouchers for "${label}" (${fyLabel(fiscalYear.value)})?`)) return

  const setId = `oneoff-${Date.now()}`
  const specs = []
  for (const row of readyRows.value) {
    const m = row.memberEmail ? membersStore.getMemberByEmail(row.memberEmail) : null
    for (let n = 0; n < rowCount(row); n++) {
      specs.push({
        type: voucherType.value,
        source: 'manual',
        fiscalYear: fiscalYear.value,
        // Blank when no one is named - the card gets a write-in line
        memberEmail: m ? m.Email.toLowerCase() : '',
        memberName: m ? `${m.FirstName || ''} ${m.LastName || ''}`.trim() : '',
        reason: label,
        set: { kind: 'oneoff', setId, label, role: '', perPerson: rowCount(row) }
      })
    }
  }

  issuing.value = true
  try {
    const n = await vouchersStore.createVouchers(specs)
    alert(`Issued ${n} vouchers for "${label}". Print them from "Print cards" (Issued by hand).`)
    reason.value = ''
    rows.value = [makeRow()]
    emit('issued')
  } catch (e) {
    alert('Could not issue vouchers: ' + e.message)
  } finally {
    issuing.value = false
  }
}
</script>

<style scoped>
.oneoff-issuer { margin-top: 0.75rem; }

.oneoff-fields { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 150px; }
.field.narrow { flex: 0 0 90px; min-width: 90px; }
.field label { font-size: 0.75rem; font-weight: 600; color: #4b5563; }
.field input, .field select { padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; }

.people-table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.875rem; }
.people-table th { font-size: 0.72rem; text-transform: uppercase; color: #6b7280; text-align: left; padding: 0.35rem 0.4rem; border-bottom: 1px solid #e5e7eb; }
.people-table td { padding: 0.3rem 0.4rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.person { min-width: 220px; }
.row-warn { margin-top: 0.2rem; font-size: 0.75rem; font-weight: 600; color: #b45309; }
.num { text-align: right; }
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
