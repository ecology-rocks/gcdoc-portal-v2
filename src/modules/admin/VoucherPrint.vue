<template>
  <div class="voucher-print">
    <div class="controls no-print">
      <div class="controls-head">
        <h1>Print Voucher Cards</h1>
        <RouterLink :to="{ name: 'vouchers' }" class="back">&larr; Back to Vouchers</RouterLink>
      </div>

      <div class="filters">
        <label>
          Fiscal year
          <select v-model.number="fyStartYear">
            <option v-for="y in fiscalYearOptions" :key="y" :value="y">{{ fyLabel(y) }}</option>
          </select>
        </label>
        <label>
          Type
          <select v-model="type">
            <option value="all">All vouchers</option>
            <option value="class">Service vouchers only</option>
            <option value="blue">Blue Ribbon vouchers only</option>
          </select>
        </label>
        <label>
          Cards
          <select v-model="statusFilter">
            <option value="created">Not published yet</option>
            <option value="reprint">Already published (reprint)</option>
          </select>
        </label>
        <label>
          From
          <select v-model="sourceFilter">
            <option value="">Earned + issued by hand</option>
            <option value="earned">Earned from hours</option>
            <option value="manual">Issued by hand</option>
          </select>
        </label>
        <label class="grow">
          Member
          <input v-model="search" type="search" placeholder="Name, email, or role">
        </label>
      </div>

      <div class="actions">
        <strong>{{ cards.length }} cards · {{ pages.length }} page{{ pages.length === 1 ? '' : 's' }}</strong>
        <button class="btn-primary" :disabled="cards.length === 0 || !qrReady" @click="printCards">
          {{ qrReady ? '🖨️ Print' : 'Preparing QR codes...' }}
        </button>
        <button
          v-if="statusFilter === 'created'"
          class="btn-secondary"
          :disabled="cards.length === 0 || marking"
          @click="markPrinted"
        >✓ Mark these {{ cards.length }} as published</button>
      </div>
      <p class="tip">
        Print on letter-size cardstock at <strong>100% / Actual size</strong> with margins set to <strong>None</strong>,
        then cut along the dashed lines. Each column is one stack: members with {{ OWN_COLUMN_MIN }}+ vouchers get their own
        column(s); smaller ones share. Blue Ribbon cards have a thick stripe on the left edge.
        After checking the printout, use "Mark as published" so these cards drop off the "Not published yet" list.
        Published cards show on the member's voucher list on the website, and can no longer be deleted.
      </p>
    </div>

    <div v-if="cards.length === 0" class="empty no-print">No cards match these filters.</div>

    <div v-for="(page, p) in pages" :key="p" class="page">
      <div v-for="(column, c) in page" :key="c" class="page-column">
      <div v-for="v in column" :key="v.code" class="card" :class="v.type">
        <div class="card-text">
          <div class="card-org">GCDOC · {{ VOUCHER_TYPES[v.type].label }}</div>
          <div class="card-value">{{ VOUCHER_TYPES[v.type].value }}</div>
          <div v-if="v.memberName" class="card-name">{{ v.memberName }}</div>
          <div v-else class="card-name card-write-in">Name:</div>
          <div class="card-household">or household</div>
          <div class="card-meta">
            {{ v.source === 'manual' ? `Issued ${fyLabel(v.fiscalYear)}` : `Earned ${fyLabel(v.fiscalYear)}` }}<span
              v-if="v.reason"> · {{ v.reason }}</span>
          </div>
          <div v-if="VOUCHER_TYPES[v.type].alt" class="card-fine card-alt">{{ VOUCHER_TYPES[v.type].alt }}</div>
          <div class="card-fine">Not transferable outside the household · No monetary value</div>
        </div>
        <div class="card-qr">
          <img v-if="qrCodes[v.code]" :src="qrCodes[v.code]" alt="">
          <div class="card-code">{{ v.code }}</div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import QRCode from 'qrcode'
import { useVouchersStore, VOUCHER_TYPES, voucherUrl, fyLabel } from '@/stores/vouchersStore'

const CARDS_PER_PAGE = 10

const vouchersStore = useVouchersStore()

onMounted(() => vouchersStore.initVouchers())

const today = new Date()
const currentFyStart = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1

const fyStartYear = ref(currentFyStart - 1)
const type = ref('all')
const statusFilter = ref('created')
const sourceFilter = ref('')
const search = ref('')

const fiscalYearOptions = computed(() => {
  const years = new Set([currentFyStart, currentFyStart - 1])
  vouchersStore.vouchers.forEach(v => years.add(v.fiscalYear))
  return [...years].sort((a, b) => b - a)
})

// A page is two columns of 5 cards with a gap between them; each column is one stack after cutting.
// Members with this many cards or more (both types combined) get their own column(s), so two
// members fit on a page and it's easy to see where one ends.
const OWN_COLUMN_MIN = 5
const CARDS_PER_COLUMN = CARDS_PER_PAGE / 2

const matchingCards = computed(() => {
  const term = search.value.trim().toLowerCase()
  return vouchersStore.vouchers
    .filter(v => v.fiscalYear === fyStartYear.value && (type.value === 'all' || v.type === type.value))
    .filter(v => statusFilter.value === 'created' ? v.status === 'created' : v.status !== 'created')
    .filter(v => !sourceFilter.value || v.source === sourceFilter.value)
    .filter(v => !term || v.memberName.toLowerCase().includes(term) || v.memberEmail.includes(term) || (v.reason || "").toLowerCase().includes(term))
})

// "Jane Smith" -> "smith jane" for sorting by last name
const lastFirst = (name) => {
  const parts = (name || '').split(' ')
  return `${parts.slice(1).join(' ')} ${parts[0]}`.toLowerCase()
}

// One group per member, most cards first, then by last name. Within a member: service, then Blue Ribbon.
const TYPE_ORDER = { class: 0, blue: 1 }
const groups = computed(() => {
  const byMember = {}
  matchingCards.value.forEach(v => {
    // Write-in cards (no person yet) stack by what they were issued for, e.g. one trial role
    const key = v.memberEmail || v.memberName || `write-in|${v.reason}`
    ;(byMember[key] ||= { name: v.memberName, cards: [] }).cards.push(v)
  })
  return Object.values(byMember)
    .map(g => ({ ...g, cards: g.cards.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.code.localeCompare(b.code)) }))
    .sort((a, b) => b.cards.length - a.cards.length || lastFirst(a.name).localeCompare(lastFirst(b.name)))
})

const cards = computed(() => groups.value.flatMap(g => g.cards))

// Lay groups into 5-card columns, then pair columns into pages.
// 5+ cards: start a fresh column and fill as many as needed (15 cards = 3 columns = 1.5 pages).
// 1-4 cards: share columns, but never split one member across two columns.
const pages = computed(() => {
  const columns = []
  let column = []
  const closeColumn = () => { if (column.length) { columns.push(column); column = [] } }

  groups.value.forEach(g => {
    if (g.cards.length >= OWN_COLUMN_MIN) {
      closeColumn()
      for (let i = 0; i < g.cards.length; i += CARDS_PER_COLUMN) {
        column = g.cards.slice(i, i + CARDS_PER_COLUMN)
        closeColumn()
      }
    } else {
      if (column.length + g.cards.length > CARDS_PER_COLUMN) closeColumn()
      column.push(...g.cards)
    }
  })
  closeColumn()

  const out = []
  for (let i = 0; i < columns.length; i += 2) out.push(columns.slice(i, i + 2))
  return out
})

// QR images, generated locally as cards come into view
const qrCodes = ref({})
const qrReady = computed(() => cards.value.every(v => qrCodes.value[v.code]))

watch(cards, async (list) => {
  const missing = list.filter(v => !qrCodes.value[v.code])
  for (const v of missing) {
    try {
      const url = await QRCode.toDataURL(voucherUrl(v.code), { margin: 0, width: 200, errorCorrectionLevel: 'M' })
      qrCodes.value = { ...qrCodes.value, [v.code]: url }
    } catch (e) {
      console.warn('QR generation failed for', v.code, e)
    }
  }
}, { immediate: true })

const printCards = () => window.print()

const marking = ref(false)
const markPrinted = async () => {
  if (!confirm(`Mark ${cards.value.length} cards as published? Members will see them on the website, and they can't be deleted after this.`)) return
  marking.value = true
  try {
    await vouchersStore.setStatus(cards.value, 'printed') // 'printed' = Published
  } catch (e) {
    alert('Could not mark as published: ' + e.message)
  } finally {
    marking.value = false
  }
}
</script>

<style scoped>
.voucher-print { font-family: system-ui, -apple-system, sans-serif; color: #111827; }

/* --- Screen controls --- */
.controls { max-width: 900px; margin: 0 auto 1.5rem; }
.controls-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
.controls-head h1 { margin: 0; font-size: 1.5rem; }
.back { color: #4f46e5; font-weight: 600; text-decoration: none; }

.filters { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1rem 0; }
.filters label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.75rem; font-weight: 600; color: #4b5563; }
.filters .grow { flex: 1; min-width: 160px; }
.filters select, .filters input { padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; }
.req { font-weight: 400; color: #9ca3af; }

.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.btn-primary { background: #4f46e5; color: white; border: none; padding: 0.5rem 0.9rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { background: #a5b4fc; cursor: not-allowed; }
.btn-secondary { border: 1px solid #cbd5e1; background: white; padding: 0.5rem 0.9rem; border-radius: 0.375rem; font-weight: 600; cursor: pointer; }
.btn-secondary:disabled { color: #9ca3af; cursor: not-allowed; }
.tip { font-size: 0.85rem; color: #6b7280; margin-top: 0.75rem; }
.empty { text-align: center; color: #6b7280; font-style: italic; padding: 2rem; }

/* --- Page: letter, 2 x 5 business cards (3.5in x 2in) --- */
.page {
  width: 8.5in;
  height: 11in;
  box-sizing: border-box;
  /* two 3.5in columns + 0.5in gap = 7.5in, centered */
  padding: 0.5in;
  display: grid;
  grid-template-columns: repeat(2, 3.5in);
  column-gap: 0.5in;
  align-content: start;
  background: white;
  margin: 0 auto 0.5in;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  break-after: page;
}
.page:last-child { break-after: auto; }

/* One stack after cutting: up to 5 cards, top to bottom */
.page-column { display: flex; flex-direction: column; }

.card {
  box-sizing: border-box;
  width: 3.5in;
  height: 2in;
  border: 1px dashed #bbb; /* cut guides */
  padding: 0.14in 0.16in;
  display: flex;
  gap: 0.1in;
  overflow: hidden;
}

/* Blue Ribbon cards print on the same white stock - a thick left stripe tells them apart */
.card.blue { border-left: 0.12in solid #1d4ed8; padding-left: 0.12in; }

.card-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.card-org { font-size: 7pt; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #374151; }
.card-value { font-size: 12pt; font-weight: 800; margin: 0.04in 0 0.08in; line-height: 1.1; }
.card-name { font-size: 10.5pt; font-weight: 700; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Blank line to write a name on */
.card-write-in { font-weight: 600; font-size: 8pt; color: #374151; border-bottom: 1px solid #000; padding-top: 0.12in; padding-bottom: 0.02in; }
.card-household { font-size: 7.5pt; color: #374151; }
/* Up to two lines, e.g. "Issued FY27 · Agility Mar 6-8, 2027 · Ring Steward/Worker Coordinator" */
.card-meta { font-size: 7pt; line-height: 1.2; color: #374151; margin-top: auto; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.card-fine { font-size: 6pt; color: #6b7280; }
.card-alt { font-weight: 700; color: #374151; }

.card-qr { width: 0.95in; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.card-qr img { width: 0.9in; height: 0.9in; }
.card-code { font-family: 'Courier New', monospace; font-size: 9pt; font-weight: 700; letter-spacing: 0.08em; margin-top: 0.04in; }

/* --- Print --- */
@media print {
  @page { size: letter; margin: 0; }
  .no-print { display: none !important; }
  .page { margin: 0; box-shadow: none; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
