<template>
  <div class="sheet-manager">
    <SheetSidebar 
      :activeSheetId="activeSheet?.id" 
      @select="handleSheetSelect"
    />
    
    <div class="workspace">
      <SheetEditor 
        v-if="activeSheet" 
        :sheet="activeSheet"
        @saved="refreshSheet"
        @statusChange="refreshSheet"
      />
      
      <div v-else class="empty-state">
        <div class="icon">📑</div>
        <p>Select a sheet to begin</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SheetSidebar from './SheetSidebar.vue'
import SheetEditor from './SheetEditor.vue'

const activeSheet = ref(null)

const handleSheetSelect = (sheet) => {
  activeSheet.value = sheet
}

const refreshSheet = () => {
  // Logic if needed to re-fetch, but reactivity usually handles this via the store
}
</script>

<style scoped>
.sheet-manager {
  display: flex;
  height: 100%;
  gap: 1rem;
  overflow: hidden;
}

.workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f9fafb;
  color: #9ca3af;
}

.icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}
</style>