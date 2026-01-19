<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 px-4">
    <div class="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden p-8">
      
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">GCDOC Portal</h1>
        <p class="text-gray-500 mt-2">Member Access & Log Tracking</p>
      </div>

      <div class="space-y-4">
        <div v-if="authStore.authError" class="bg-red-50 text-red-600 p-3 rounded text-sm text-center">
          {{ authStore.authError }}
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Email Address</label>
          <input 
            v-model="email" 
            type="email" 
            class="w-full mt-1 p-3 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Enter the email you use for the club"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Password</label>
          <input 
            v-model="password" 
            type="password" 
            class="w-full mt-1 p-3 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="••••••••"
          >
        </div>

        <button 
          v-if="mode === 'login'"
          @click="handleLogin" 
          :disabled="loading"
          class="w-full bg-indigo-600 text-white py-3 rounded-md font-bold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {{ loading ? 'Signing In...' : 'Sign In' }}
        </button>

        <button 
          v-else
          @click="handleRegister" 
          :disabled="loading"
          class="w-full bg-green-600 text-white py-3 rounded-md font-bold hover:bg-green-700 transition disabled:opacity-50"
        >
          {{ loading ? 'Creating Account...' : 'Activate Account' }}
        </button>
      </div>

      <div class="mt-6 text-center text-sm">
        <p v-if="mode === 'login'">
          First time here? 
          <a href="#" @click.prevent="mode = 'register'" class="text-indigo-600 font-bold hover:underline">Activate your account</a>
        </p>
        <p v-else>
          Already have an account? 
          <a href="#" @click.prevent="mode = 'login'" class="text-indigo-600 font-bold hover:underline">Sign In</a>
        </p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const mode = ref('login') // 'login' or 'register'
const email = ref('')
const password = ref('')
const loading = ref(false)

const handleLogin = async () => {
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.push('/')
  } catch (e) {
    // error handled in store
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  loading.value = true
  try {
    await authStore.register(email.value, password.value)
    router.push('/')
  } catch (e) {
    // error handled in store
  } finally {
    loading.value = false
  }
}
</script>