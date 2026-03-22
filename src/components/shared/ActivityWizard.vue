<template>
  <div class="activity-wizard">
    <div v-if="step === 1" class="step-content">
      <label class="step-label">What kind of activity?</label>
      <div class="button-grid">
        <button @click="selectCategory('MAINT')" class="grid-btn border-orange">🧹 Cleaning / Maintenance</button>
        <button @click="selectCategory('SETUP')" class="grid-btn border-purple">🏗️ Trial Setup / Teardown</button>
        <button @click="selectCategory('PRACTICE')" class="grid-btn">🐕 Practices / Runthroughs</button>
        <button @click="selectCategory('ADMIN')" class="grid-btn">📝 Admin / Meetings</button>
        <button @click="selectCategory('OTHER')" class="grid-btn">❓ Other</button>
      </div>
    </div>

    <div v-if="step === 2" class="step-content">
      <button @click="step = 1" class="back-link">← Back</button>
      <label class="step-label">Which Sport?</label>
      <div class="button-grid two-col">
        <button v-for="s in sports" :key="s" @click="selectSport(s)" class="grid-btn">
          {{ s }}
        </button>
      </div>
    </div>

    <div v-if="step === 3" class="step-content">
      <button @click="goBackFromNotes" class="back-link">← Back</button>
      <label class="step-label">Notes / Details (Optional)</label>
      <div class="form-group">
        <input 
          v-model="notes" 
          type="text" 
          class="input-field" 
          placeholder="e.g. Fixed hot water, Ring 1..."
          @keyup.enter="finish"
          autofocus
        />
      </div>
      <button @click="finish" class="action-btn primary mt-4">Confirm Activity</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLogsStore } from '@/stores/logsStore'

const logsStore = useLogsStore()
const emit = defineEmits(['complete'])

const step = ref(1)
const category = ref('')
const sport = ref('')
const notes = ref('')

const sports = ['Agility', 'Barn Hunt', 'Conformation', 'Rally', 'Obedience', 'Freestyle', 'Coursing', 'Other']

const needsSport = computed(() => {
  return ['SETUP', 'PRACTICE'].includes(category.value)
})

const selectCategory = (cat) => {
  category.value = cat
  step.value = needsSport.value ? 2 : 3
}

const selectSport = (s) => {
  sport.value = s
  step.value = 3
}

const goBackFromNotes = () => {
  step.value = needsSport.value ? 2 : 1
}

const finish = () => {
  const typeString = logsStore.logType(category.value)
  
  let act = notes.value || ''
  if (category.value === 'MAINT') {
    act = act || 'Cleaning / Maintenance'
  } else if (category.value === 'SETUP') {
    act = act ? `Trial Setup - ${sport.value} (${act})` : `Trial Setup - ${sport.value}`
  } else if (category.value === 'PRACTICE') {
    act = act ? `Practices - ${sport.value} (${act})` : `Practices - ${sport.value}`
  } else if (category.value === 'ADMIN') {
    act = act ? `Meetings and Admin (${act})` : `Meetings and Admin`
  } else {
    act = act || 'Other Volunteer Work'
  }

  emit('complete', {
    category: category.value,
    sport: sport.value,
    notes: notes.value,
    type: typeString,
    activity: act
  })
}
</script>

<style scoped>
.activity-wizard {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}
.step-label {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
  color: #374151;
}
.button-grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; }
.button-grid.two-col { grid-template-columns: 1fr 1fr; }
.grid-btn {
  padding: 1rem; text-align: left; background: white;
  border: 1px solid #d1d5db; border-radius: 0.5rem;
  font-size: 1rem; cursor: pointer; transition: all 0.2s; font-weight: 500;
}
.grid-btn:hover { background: #eff6ff; border-color: #6366f1; transform: translateY(-1px); }
.border-orange { border-left: 4px solid #f97316; }
.border-purple { border-left: 4px solid #a855f7; }
.back-link {
  background: none; border: none; color: #6b7280; cursor: pointer;
  font-size: 0.9rem; margin-bottom: 1rem; padding: 0;
}
.back-link:hover { text-decoration: underline; }
.input-field {
  width: 100%; padding: 0.75rem; border: 1px solid #d1d5db;
  border-radius: 0.5rem; font-size: 1rem; box-sizing: border-box;
}
.action-btn {
  width: 100%; padding: 1rem; border-radius: 0.5rem; font-size: 1.1rem;
  font-weight: 700; cursor: pointer; border: none;
}
.action-btn.primary { background-color: #4f46e5; color: white; }
.mt-4 { margin-top: 1rem; }
</style>