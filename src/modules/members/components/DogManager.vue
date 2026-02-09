<template>
  <div class="dog-manager">
    <div class="dm-header">
      <div class="title-group">
        <span class="icon">🐕</span>
        <h3>Dogs</h3>
      </div>
      <button @click="openModal()" class="btn-add">
        + Add Dog
      </button>
    </div>

    <div v-if="loading" class="loading">Loading dogs...</div>

    <div v-else class="dogs-grid">
      <div v-for="dog in dogs" :key="dog.id" class="dog-card">
        <div class="dog-info">
          <div class="dog-title">
            <span class="name">{{ dog.name }}</span>
            <span v-if="dog.neutered" class="badge-neutered">Neutered</span>
          </div>
          <div class="dog-meta">
            {{ dog.breed }} • {{ dog.sex === 'M' ? 'Male' : dog.sex === 'F' ? 'Female' : 'Unknown' }}
          </div>
          <div class="dog-born">
            Born: {{ dog.birthdate || 'N/A' }}
          </div>
          <div class="dog-stats">
            <span class="stat" :class="dog.vaccinations?.length ? 'stat-green' : 'stat-red'">
              {{ dog.vaccinations?.length || 0 }} Vaccines
            </span>
            <span class="stat stat-gray">
              {{ dog.notes?.length || 0 }} Notes
            </span>
          </div>
        </div>
        <div class="dog-actions">
          <button @click="openModal(dog.id)" class="btn-manage">Manage</button>
          <button @click="deleteDog(dog.id)" class="btn-delete">Delete</button>
        </div>
      </div>
      
      <div v-if="dogs.length === 0" class="empty-state">
        No dogs added yet.
      </div>
    </div>

    <DogModal 
      :is-open="isModalOpen" 
      :dog-id="selectedDogId"
      :owner-email="ownerEmail"
      @close="isModalOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useDogStore } from '@/stores/dogStore'
import DogModal from './DogModal.vue'

const props = defineProps({
  ownerEmail: { type: String, required: true }
})

const dogStore = useDogStore()
const loading = ref(false)
const isModalOpen = ref(false)
const selectedDogId = ref(null)

const dogs = computed(() => dogStore.getDogsByOwner(props.ownerEmail))

watch(() => props.ownerEmail, async (newVal) => {
  if (newVal) {
    loading.value = true
    await dogStore.fetchDogsForOwner(newVal)
    loading.value = false
  }
}, { immediate: true })

const openModal = (id = null) => {
  selectedDogId.value = id
  isModalOpen.value = true
}

const deleteDog = async (id) => {
  if (confirm("Delete this dog? This cannot be undone.")) {
    await dogStore.deleteDog(id)
  }
}
</script>

<style scoped>
.dog-manager {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  padding: 1.5rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
}

.dm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon { font-size: 1.5rem; }

.dm-header h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: #1f2937;
}

.btn-add {
  background-color: #4f46e5;
  color: white;
  padding: 0.375rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.btn-add:hover { background-color: #4338ca; }

.loading {
  color: #6b7280;
  font-style: italic;
}

.dogs-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.dog-card {
  background: white;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  border: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.dog-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.name {
  font-weight: 700;
  font-size: 1.125rem;
  color: #111827;
}

.badge-neutered {
  font-size: 0.65rem;
  background-color: #dbeafe;
  color: #1e40af;
  padding: 2px 6px;
  border-radius: 9999px;
  text-transform: uppercase;
  font-weight: 700;
}

.dog-meta {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.dog-born {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.dog-stats {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.stat {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 0.25rem;
  border-width: 1px;
  border-style: solid;
}

.stat-green {
  background-color: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.stat-red {
  background-color: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.stat-gray {
  background-color: #f9fafb;
  border-color: #e5e7eb;
  color: #4b5563;
}

.dog-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn-manage, .btn-delete {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  background: white;
  cursor: pointer;
  width: 100%;
}

.btn-manage {
  border: 1px solid #c7d2fe;
  color: #4f46e5;
}
.btn-manage:hover { background-color: #e0e7ff; }

.btn-delete {
  border: 1px solid #fecaca;
  color: #dc2626;
}
.btn-delete:hover { background-color: #fef2f2; }

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  background-color: white;
  border: 1px dashed #d1d5db;
  border-radius: 0.25rem;
}

@media (min-width: 768px) {
  .dogs-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>