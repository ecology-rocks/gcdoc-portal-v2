<template>
  <div class="login-container">
    <div class="login-card">

      <div class="login-header">
        <h1>GCDOC Portal</h1>
        <p>Admin Access</p>
      </div>

      <div class="login-form">
        <div v-if="authStore.authError" class="error-message">
          {{ authStore.authError }}
        </div>

        <div class="form-group">
          <label>Email Address</label>
          <input
            v-model="email"
            type="email"
            class="form-input"
            placeholder="Enter your admin email"
          >
        </div>

        <div class="form-group">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            class="form-input"
            placeholder="••••••••"
          >
        </div>

        <button
          @click="handleLogin"
          :disabled="loading"
          class="btn btn-primary"
        >
          {{ loading ? 'Working...' : 'Sign In' }}
        </button>
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

const email = ref('')
const password = ref('')
const loading = ref(false)

const handleLogin = async () => {
  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    router.push(authStore.isKioskUser ? '/kiosk' : '/')
  } catch (e) {
    // error handled in store
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0f172a; /* Slate 900 */
  padding: 1rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.login-card {
  width: 100%;
  max-width: 450px;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  padding: 2rem;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.login-header p {
  color: #6b7280;
  margin-top: 0.5rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error-message {
  background-color: #fef2f2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  text-align: center;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.25rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  box-sizing: border-box; /* Crucial for input width */
}

.form-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.btn {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 700;
  cursor: pointer;
  font-size: 1rem;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #4f46e5;
  color: white;
}
.btn-primary:hover:not(:disabled) { background-color: #4338ca; }
</style>
