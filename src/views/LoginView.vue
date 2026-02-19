<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../lib/strapi'

const router = useRouter()
const identifier = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    const response = await login(identifier.value, password.value)
    localStorage.setItem('sk_token', response.jwt)
    localStorage.setItem('sk_user', JSON.stringify(response.user))
    await router.push('/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur de connexion'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth-shell">
    <div class="auth-card">
      <div class="brand auth-brand">
        <div class="brand-mark">SK</div>
        <div class="brand-copy">
          <span class="brand-name">StreamKo</span>
          <span class="brand-sub">Private Cinema</span>
        </div>
      </div>

      <h1>Connexion</h1>
      <p>Acces reserve. Identifiez-vous pour continuer.</p>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          Identifiant
          <input v-model="identifier" type="text" placeholder="username ou email" required />
        </label>
        <label>
          Mot de passe
          <input v-model="password" type="password" placeholder="••••••••" required />
        </label>
        <button class="cta" type="submit" :disabled="loading">
          {{ loading ? 'Connexion...' : 'Se connecter' }}
        </button>
        <span v-if="error" class="form-error">{{ error }}</span>
      </form>

      <div class="auth-foot">
        <span>Comptes geres par l'administrateur.</span>
      </div>
    </div>
  </section>
</template>
