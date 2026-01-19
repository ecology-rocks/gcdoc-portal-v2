<template>
  <div class="image-viewer" ref="containerRef">
    <div class="viewer-toolbar">
      <div class="rotate-controls">
        <button @click="rotateLeft" title="Rotate Left">↺</button>
        <button @click="rotateRight" title="Rotate Right">↻</button>
      </div>
      <div class="sheet-label">Sheet #{{ sheet.shortId }}</div>
    </div>

    <div class="image-canvas">
      <div v-if="!sheet.imageUrl" class="error-msg">⚠️ No Image</div>
      <img 
        v-else
        :src="sheet.imageUrl"
        :style="imageStyle"
        class="sheet-image"
        alt="Log Sheet"
      >
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps(['sheet'])

const rotation = ref(0)
const containerRef = ref(null)
const containerSize = ref({ width: 0, height: 0 })
let resizeObserver = null

// Reset rotation when sheet changes
watch(() => props.sheet.id, () => {
  rotation.value = 0
})

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      containerSize.value = {
        width: entry.contentRect.width,
        height: entry.contentRect.height
      }
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

const rotateLeft = () => rotation.value -= 90
const rotateRight = () => rotation.value += 90

const imageStyle = computed(() => {
  const isRotated = rotation.value % 180 !== 0
  const { width: cW, height: cH } = containerSize.value
  
  if (!cW || !cH) return { opacity: 0 } 

  // 20px buffer for aesthetics
  const buffer = 20 
  
  return {
    transform: `rotate(${rotation.value}deg)`,
    // The Core Math: If rotated, width constraint becomes container height
    maxWidth: (isRotated ? cH : cW) - buffer + 'px',
    maxHeight: (isRotated ? cW : cH) - buffer + 'px'
  }
})
</script>

<style scoped>
.image-viewer {
  flex: 1; /* Takes top half */
  background-color: #0f172a;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-toolbar {
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
  display: flex;
  justify-content: space-between;
  z-index: 20;
  pointer-events: none; 
}

.rotate-controls, .sheet-label {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.25rem;
  border-radius: 0.5rem;
  color: white;
  display: flex;
  gap: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.rotate-controls button {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.sheet-label {
  padding: 0.5rem 1rem;
  font-family: monospace;
  font-weight: bold;
}

.image-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-image {
  /* Transition for smooth rotation */
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  display: block;
}

.error-msg {
  color: #94a3b8;
  font-size: 1.5rem;
  font-weight: bold;
}
</style>