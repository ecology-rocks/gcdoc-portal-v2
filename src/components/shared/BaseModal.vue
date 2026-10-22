<template>
  <Teleport to="body">
    <div v-if="open || persistent" v-show="open" class="modal-overlay" @mousedown.self="close">
      <div class="modal" :class="size" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h2>{{ title }}</h2>
          <button type="button" class="close-btn" title="Close" @click="close">✕</button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'

// size: 'md' (default) for details, 'lg' for the voucher issuing forms.
// persistent: keep the contents mounted while closed, so a half-filled form survives a stray click outside.
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' },
  persistent: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const close = () => emit('close')
const onKey = (e) => { if (e.key === 'Escape') close() }

watch(() => props.open, (isOpen) => {
  if (isOpen) document.addEventListener('keydown', onKey)
  else document.removeEventListener('keydown', onKey)
}, { immediate: true })
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3vh 1rem;
  z-index: 50;
  overflow-y: auto;
}
.modal {
  background: white;
  border-radius: 0.6rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  max-height: 94vh;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}
.modal.lg { max-width: 960px; }
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid #e5e7eb;
}
.modal-head h2 { margin: 0; font-size: 1.15rem; }
.close-btn { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #6b7280; padding: 0.2rem 0.4rem; }
.close-btn:hover { color: #111827; }
.modal-body { padding: 1rem 1.1rem; overflow-y: auto; }
.modal-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0.75rem 1.1rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 0.6rem 0.6rem;
}
</style>
