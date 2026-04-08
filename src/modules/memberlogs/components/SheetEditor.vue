<template>
  <div class="editor-container">
    <div class="editor-toolbar">
      <div class="sheet-meta">
        <strong>Sheet #{{ sheet.shortId }}</strong>
        <span>{{ formatDate(sheet.uploadedAt) }}</span>
      </div>
      <div class="sheet-actions">
        <button class="btn-secondary" @click="showImageModal = true">View Image</button>
        <button class="btn-secondary" @click="openImageWindow">Open in New Window</button>
      </div>
    </div>

    <SheetDataEntry 
      :sheet="sheet" 
      @saved="$emit('saved')"
      @statusChange="$emit('statusChange')"
    />

    <div v-if="showImageModal" class="image-modal" @click.self="showImageModal = false">
      <div class="image-dialog">
        <div class="image-header">
          <strong>Sheet #{{ sheet.shortId }}</strong>
          <button class="btn-close" @click="showImageModal = false">×</button>
        </div>

        <div class="image-canvas">
          <div v-if="!sheet.imageUrl" class="no-image">No image available.</div>
          <img
            v-else
            :src="sheet.imageUrl"
            :style="{ transform: `rotate(${rotation}deg)` }"
            class="modal-image"
            alt="Sign-in sheet"
          >
        </div>

        <div class="image-actions">
          <button class="btn-secondary" @click="rotate(-90)">Rotate Left</button>
          <button class="btn-secondary" @click="rotate(90)">Rotate Right</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useSheetsStore } from '@/stores/sheetsStore'
import SheetDataEntry from './SheetDataEntry.vue'

const props = defineProps(['sheet'])
defineEmits(['saved', 'statusChange'])

const sheetsStore = useSheetsStore()
const showImageModal = ref(false)
const rotation = ref(0)

watch(() => props.sheet, (sheet) => {
  rotation.value = sheet?.rotation || 0
}, { immediate: true })

const rotate = async (delta) => {
  if (!props.sheet?.id) return
  rotation.value += delta
  await sheetsStore.updateSheetRotation(props.sheet.id, rotation.value)
}

const openImageWindow = () => {
  if (!props.sheet?.imageUrl) return
  window.open(props.sheet.imageUrl, '_blank', 'noopener,noreferrer')
}

const formatDate = (ts) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString()
}
</script>

<style scoped>
.editor-container {
  display: block;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.sheet-meta {
  display: flex;
  flex-direction: column;
  color: #334155;
  font-size: 0.875rem;
}

.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-secondary {
  border: 1px solid #cbd5e1;
  background: white;
  color: #334155;
  border-radius: 0.375rem;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.image-modal {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.image-dialog {
  width: min(96vw, 1200px);
  max-height: 92vh;
  background: #0f172a;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.image-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #e2e8f0;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.btn-close {
  border: none;
  background: transparent;
  color: #e2e8f0;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
}

.image-canvas {
  flex: 1;
  min-height: 320px;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}

.modal-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  transition: transform 0.2s ease;
  box-shadow: 0 10px 35px rgba(15, 23, 42, 0.6);
}

.no-image {
  color: #94a3b8;
  font-weight: 600;
}

.image-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  padding: 0.75rem 1rem 1rem;
}

@media (max-width: 768px) {
  .sheet-actions {
    width: 100%;
  }

  .btn-secondary {
    flex: 1 1 auto;
  }
}
</style>