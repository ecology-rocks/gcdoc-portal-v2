<template>
  <div class="bg-gray-50 rounded-lg border border-gray-200 p-6">
    <div class="flex justify-between items-center mb-6">
      <div class="flex items-center gap-2">
        <span class="text-2xl">🐕</span>
        <h3 class="text-xl font-bold text-gray-800">Dogs</h3>
      </div>
      <button @click="openModal()" class="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 shadow">
        + Add Dog
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 italic">Loading dogs...</div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="dog in dogs" :key="dog.id" class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-start">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-lg text-gray-900">{{ dog.name }}</span>
            <span v-if="dog.neutered" class="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full uppercase font-bold">Neutered</span>
          </div>
          <div class="text-sm text-gray-500 mt-1">
            {{ dog.breed }} • {{ dog.sex === 'M' ? 'Male' : dog.sex === 'F' ? 'Female' : 'Unknown' }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            Born: {{ dog.birthdate || 'N/A' }}
          </div>
          <div class="flex gap-2 mt-3">
            <span class="text-xs px-2 py-0.5 rounded border" :class="dog.vaccinations?.length ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'">
              {{ dog.vaccinations?.length || 0 }} Vaccines
            </span>
            <span class="text-xs px-2 py-0.5 rounded border bg-gray-50 border-gray-200 text-gray-600">
              {{ dog.notes?.length || 0 }} Notes
            </span>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <button @click="openModal(dog.id)" class="text-xs border border-indigo-200 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-50">Manage</button>
          <button @click="deleteDog(dog.id)" class="text-xs border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
        </div>
      </div>
      
      <div v-if="dogs.length === 0" class="col-span-full text-center py-8 text-gray-400 bg-white rounded border border-dashed border-gray-300">
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

// Fetch dogs when email changes or component mounts
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