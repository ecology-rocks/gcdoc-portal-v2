<template>
  <div class="login-container">
    <div class="login-card">

      <div class="login-header">
        <h1>GCDOC Portal</h1>
        <p>Member Access & Log Tracking</p>
      </div>

      <div class="login-form">
        <div v-if="authStore.authError" class="error-message">
          {{ authStore.authError }}
        </div>

        <div class="form-group">
          <label>Email Address</label>
          <input
            v-model="email"
            @input="handleEmailInput"
            type="email"
            class="form-input"
            placeholder="Enter the email you use for the club"
          >
        </div>

        <div v-if="pendingEmailLink" class="info-message">
          Finish sign-in: enter the same email used to request the sign-in link, then click Continue.
        </div>

        <div v-if="loginMethod === 'password' || mode === 'register'" class="form-group">
          <label>Password</label>
          <input
            v-model="password"
            type="password"
            class="form-input"
            placeholder="••••••••"
          >
        </div>

        <div v-if="emailLinkSent" class="info-message">
          Sign-in link sent. Check your email and click the link to finish logging in.
        </div>

        <button
          v-if="mode === 'login'"
          @click="handleLogin"
          :disabled="loading"
          class="btn btn-primary"
        >
          {{ loading ? 'Working...' : 'Continue' }}
        </button>

        <button
          v-else
          @click="handleRegister"
          :disabled="loading"
          class="btn btn-success"
        >
          {{ loading ? 'Creating Account...' : 'Activate Account' }}
        </button>
      </div>

      <div class="login-footer">
        <p v-if="mode === 'login'">
          First time here?
          <a href="#" @click.prevent="mode = 'register'">Activate your account</a>
        </p>
        <p v-else>
          Already have an account?
          <a href="#" @click.prevent="mode = 'login'">Sign In</a>
        </p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const mode = ref('login') // 'login' or 'register'
const email = ref('')
const password = ref('')
const loading = ref(false)
const loginMethod = ref(null) // 'password' | 'email-link'
const emailLinkSent = ref(false)
const pendingEmailLink = ref(false)

const resolveLoginMethod = async () => {
  loginMethod.value = await authStore.getLoginMethodForEmail(email.value)
  return loginMethod.value
}

const completeEmailLinkIfPresent = async () => {
  if (!authStore.isPasswordlessLink(window.location.href)) return

  pendingEmailLink.value = true
  if (!email.value) {
    email.value = authStore.resolvePasswordlessEmail(window.location.href)
  }

  if (!email.value) return

  loading.value = true
  try {
    await authStore.completePasswordlessSignIn(window.location.href, email.value)
    router.push(authStore.isKioskUser ? '/kiosk' : '/')
  } catch (e) {
    // error handled in store
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  completeEmailLinkIfPresent()
})

const handleLogin = async () => {
  loading.value = true
  try {
    emailLinkSent.value = false

    if (pendingEmailLink.value && authStore.isPasswordlessLink(window.location.href)) {
      const completionEmail = authStore.resolvePasswordlessEmail(window.location.href, email.value)
      await authStore.completePasswordlessSignIn(window.location.href, completionEmail)
      router.push(authStore.isKioskUser ? '/kiosk' : '/')
      return
    }

    const method = await resolveLoginMethod()

    if (method === 'password') {
      await authStore.login(email.value, password.value)
      router.push(authStore.isKioskUser ? '/kiosk' : '/')
      return
    }

    await authStore.sendPasswordlessLink(email.value)
    emailLinkSent.value = true
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

const handleEmailInput = () => {
  loginMethod.value = null
  emailLinkSent.value = false
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

.info-message {
  background-color: #eff6ff;
  color: #1d4ed8;
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

.btn-success {
  background-color: #16a34a;
  color: white;
}
.btn-success:hover:not(:disabled) { background-color: #15803d; }

.login-footer {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: #4b5563;
}

.login-footer a {
  color: #4f46e5;
  font-weight: 700;
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}
</style>