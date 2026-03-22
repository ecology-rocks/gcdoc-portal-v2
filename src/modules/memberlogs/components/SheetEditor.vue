<template>
  <div class="editor-container">
    <SheetImageViewer :sheet="sheet" />
    <SheetDataEntry 
      :sheet="sheet" 
      @saved="$emit('saved')"
      @statusChange="$emit('statusChange')"
    />
  </div>
</template>

<script setup>
import SheetImageViewer from './SheetImageViewer.vue'
import SheetDataEntry from './SheetDataEntry.vue'

defineProps(['sheet'])
defineEmits(['saved', 'statusChange'])
</script>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  /* Lock it to the screen height minus ~80px for your top nav */
  height: calc(100vh - 80px); 
  /* Prevent it from getting completely squished on small laptop screens */
  min-height: 800px; 
  overflow: hidden;
}
</style>