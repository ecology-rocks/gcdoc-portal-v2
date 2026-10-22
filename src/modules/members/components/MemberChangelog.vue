<template>
  <div class="changelog">
    <div class="cl-header">
      <div class="title-group">
        <span class="icon">🕘</span>
        <h3>History</h3>
      </div>
    </div>

    <form class="note-form" @submit.prevent="saveNote">
      <input
        v-model="noteText"
        type="text"
        class="note-input"
        placeholder="Add a note (e.g. Moved to Florida)"
      >
      <button type="submit" class="btn-add" :disabled="!noteText.trim() || savingNote">
        {{ savingNote ? 'Saving...' : 'Add Note' }}
      </button>
    </form>

    <div v-if="loading" class="muted">Loading history...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="entries.length === 0" class="muted">
      No history yet. Status changes, dues payments, applicant steps, and notes will appear here.
    </div>

    <ul v-else class="entries">
      <li v-for="entry in entries" :key="entry.id" class="entry">
        <span class="entry-icon">{{ describe(entry).icon }}</span>
        <div class="entry-body">
          <div class="entry-text">{{ describe(entry).text }}</div>
          <div v-if="describe(entry).detail" class="entry-detail">{{ describe(entry).detail }}</div>
          <div class="entry-meta">{{ formatDate(entry.date) }}<span v-if="entry.by"> · {{ entry.by }}</span></div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useMembersStore, DUES_PENDING_REASONS } from '@/stores/membersStore'

const props = defineProps(['memberEmail'])

const store = useMembersStore()
const entries = ref([])
const loading = ref(false)
const error = ref('')
const noteText = ref('')
const savingNote = ref(false)

const load = async () => {
  if (!props.memberEmail) return
  loading.value = true
  error.value = ''
  try {
    entries.value = await store.fetchChangelog(props.memberEmail)
  } catch (e) {
    error.value = e?.code === 'permission-denied'
      ? 'History is blocked by the database rules - the changelog rule needs to be published.'
      : 'Could not load history: ' + e.message
  } finally {
    loading.value = false
  }
}

watch(() => props.memberEmail, load, { immediate: true })

const saveNote = async () => {
  savingNote.value = true
  try {
    await store.addChangelogNote(props.memberEmail, noteText.value)
    noteText.value = ''
    await load()
  } catch (e) {
    alert('Could not save note: ' + e.message)
  } finally {
    savingNote.value = false
  }
}

const describe = (entry) => {
  switch (entry.type) {
    case 'status_change':
      return {
        icon: '🏷️',
        text: entry.from ? `Type changed: ${entry.from} → ${entry.to}` : `Type set to ${entry.to}`,
        detail: entry.note
      }
    case 'dues_payment':
      return { icon: '💵', text: `${entry.duesYear} dues marked paid` }
    case 'dues_payment_reversed':
      return { icon: '↩️', text: `${entry.duesYear} dues marked unpaid` }
    case 'dues_pending':
      return { icon: '⏳', text: `${entry.duesYear} dues pending: ${entry.reason === 'other' ? 'other' : DUES_PENDING_REASONS[entry.reason] || entry.reason}`, detail: entry.note }
    case 'dues_pending_cleared':
      return { icon: '↩️', text: `${entry.duesYear} dues no longer pending (marked not paid)` }
    case 'applicant_step':
      return entry.done
        ? { icon: '✅', text: `Applicant: ${entry.label}` }
        : { icon: '⬜', text: `Applicant: ${entry.label} unchecked` }
    case 'email_change':
      return { icon: '✉️', text: `Email changed: ${entry.from} → ${entry.to}` }
    case 'note':
      return { icon: '📝', text: entry.text }
    default:
      return { icon: '•', text: entry.type }
  }
}

const formatDate = (ts) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.changelog {
  margin-top: 2rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  padding: 1.5rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}

.cl-header { margin-bottom: 1rem; }

.title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon { font-size: 1.5rem; }

.cl-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.note-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.note-input {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.9rem;
}

.btn-add {
  background-color: #4f46e5;
  color: white;
  padding: 0.375rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}
.btn-add:disabled { background-color: #a5b4fc; cursor: not-allowed; }

.muted { color: #6b7280; font-style: italic; font-size: 0.9rem; }
.error { color: #b91c1c; font-size: 0.9rem; }

.entries {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.entry {
  display: flex;
  gap: 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  padding: 0.6rem 0.75rem;
}

.entry-icon { font-size: 1.1rem; line-height: 1.4; }

.entry-text { font-weight: 600; font-size: 0.95rem; }
.entry-detail { font-size: 0.875rem; color: #374151; margin-top: 0.15rem; }
.entry-meta { font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem; }
</style>
