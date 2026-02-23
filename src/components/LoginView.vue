<script setup lang="ts">
import { computed, ref } from 'vue'

import { StrapiRequestError } from '../lib/strapiClient'
import { streamyApi } from '../lib/streamyApi'

const emit = defineEmits<{
  loginSuccess: [token: string]
}>()

const identifier = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const canSubmit = computed(() => {
  return identifier.value.trim().length > 0 && password.value.trim().length > 0 && !loading.value
})

const submit = async (): Promise<void> => {
  if (!canSubmit.value) {
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await streamyApi.login(identifier.value.trim(), password.value)
    emit('loginSuccess', response.jwt)
  } catch (error) {
    if (error instanceof StrapiRequestError) {
      errorMessage.value = `Login failed (${error.status}): ${error.message}`
      loading.value = false
      return
    }

    errorMessage.value = 'Login failed due to an unexpected error.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-layout">
    <section class="login-panel reveal-1">
      <p class="eyebrow">Login</p>
      <h1>Connect to StreamKo</h1>
      <p class="hero-copy">
        Use your Users & Permissions account to unlock catalogue, movie detail and player routes.
      </p>

      <form class="login-form" @submit.prevent="submit">
        <label class="login-field">
          <span>Identifier</span>
          <input
            v-model="identifier"
            class="login-input"
            type="text"
            autocomplete="username"
            placeholder="email or username"
            :disabled="loading"
          />
        </label>

        <label class="login-field">
          <span>Password</span>
          <input
            v-model="password"
            class="login-input"
            type="password"
            autocomplete="current-password"
            placeholder="your password"
            :disabled="loading"
          />
        </label>

        <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>

        <button type="submit" class="primary-btn login-submit" :disabled="!canSubmit">
          {{ loading ? 'Connecting...' : 'Sign in' }}
        </button>
      </form>
    </section>
  </main>
</template>
