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
  height: 100%;
  overflow: hidden;
}
</style>