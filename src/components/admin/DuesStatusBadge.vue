<template>
  <div ref="root" class="dues-status">
    <button
      type="button"
      class="dues-badge"
      :class="'dues-' + status"
      :disabled="saving"
      :title="title"
      @click="open = !open"
    >
      {{ DUES_YEAR }} Dues: {{ label }} ▾
    </button>

    <div v-if="open" class="dues-menu" role="menu">
      <button type="button" class="opt opt-paid" :class="{ current: status === 'paid' }" @click="choose('paid')">✓ Paid</button>
      <button
        v-for="(text, key) in PENDING_CHOICES"
        :key="key"
        type="button"
        class="opt opt-pending"
        :class="{ current: status === 'pending' && member.Dues2026PendingReason === key }"
        @click="choose('pending', key)"
      >⏳ Pending: {{ text }}</button>
      <button type="button" class="opt opt-unpaid" :class="{ current: status === 'unpaid' }" @click="choose('unpaid')">✗ Not paid</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMembersStore, duesStatus, duesPendingText, DUES_PENDING_REASONS, DUES_YEAR } from '@/stores/membersStore'

// Paid / Pending (with a reason) / Not paid, as a badge that opens a small menu. Saves on pick.
const props = defineProps({ member: { type: Object, required: true } })

const PENDING_CHOICES = { ...DUES_PENDING_REASONS, other: 'Other...' }

const store = useMembersStore()
const open = ref(false)
const saving = ref(false)
const root = ref(null)

const status = computed(() => duesStatus(props.member))
const label = computed(() => ({
  paid: 'Paid',
  pending: `Pending (${duesPendingText(props.member)})`,
  unpaid: 'Not Paid'
})[status.value])

const sinceText = (ts) => (ts?.toDate ? ` since ${ts.toDate().toLocaleDateString()}` : '')
const title = computed(() => {
  if (status.value === 'paid') return `Paid${sinceText(props.member.Dues2026PaidAt).replace('since', 'on')}`
  if (status.value === 'pending') return `Pending${sinceText(props.member.Dues2026PendingAt)}: ${duesPendingText(props.member)}`
  return 'Not paid'
})

const choose = async (next, reason = '') => {
  open.value = false
  let note = ''
  if (next === 'pending' && reason === 'other') {
    const answer = prompt('What are you waiting on?', props.member.Dues2026PendingReason === 'other' ? props.member.Dues2026PendingNote || '' : '')
    if (answer === null) return
    note = answer.trim()
    if (!note) return alert('Please describe what is pending.')
  }
  // Re-picking the same thing is a no-op (no duplicate history entries)
  if (next === status.value && (next !== 'pending' || (reason === props.member.Dues2026PendingReason && note === (props.member.Dues2026PendingNote || '')))) return

  saving.value = true
  try {
    await store.setDuesStatus(props.member.Email, next, { reason, note })
  } catch (err) {
    console.error('Failed to update dues status', err)
    alert('Failed to update dues status.')
  } finally {
    saving.value = false
  }
}

// Close the menu on a click anywhere else
const onDocClick = (e) => { if (open.value && root.value && !root.value.contains(e.target)) open.value = false }
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<style scoped>
.dues-status { position: relative; display: inline-block; }
.dues-badge {
  border: 1px solid transparent;
  border-radius: 0.375rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.dues-badge:disabled { opacity: 0.6; cursor: wait; }
.dues-paid { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
.dues-pending { background: #fffbeb; border-color: #fde68a; color: #92400e; }
.dues-unpaid { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }

.dues-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 220px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
}
.opt {
  background: none;
  border: none;
  text-align: left;
  padding: 0.45rem 0.6rem;
  border-radius: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.opt:hover { background: #f3f4f6; }
.opt.current { background: #eef2ff; }
.opt-paid { color: #15803d; }
.opt-pending { color: #92400e; }
.opt-unpaid { color: #b91c1c; }
</style>
