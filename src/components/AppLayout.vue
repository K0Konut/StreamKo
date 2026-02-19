<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const user = computed(() => {
  const raw = localStorage.getItem('sk_user')
  return raw ? JSON.parse(raw) : null
})

const initials = computed(() => {
  if (!user.value?.username) return '??'
  return user.value.username.slice(0, 2).toUpperCase()
})

const logout = () => {
  localStorage.removeItem('sk_token')
  localStorage.removeItem('sk_user')
  router.push('/login')
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">SK</div>
      <div class="brand-copy">
        <span class="brand-name">StreamKo</span>
        <span class="brand-sub">Private Cinema</span>
      </div>
    </div>

    <nav class="nav-links">
      <RouterLink to="/" class="nav-link" active-class="is-active">Accueil</RouterLink>
      <RouterLink to="/films" class="nav-link" active-class="is-active">Films</RouterLink>
      <RouterLink to="/series" class="nav-link" active-class="is-active">Series</RouterLink>
      <RouterLink to="/ma-liste" class="nav-link" active-class="is-active">Ma liste</RouterLink>
    </nav>

    <div class="top-actions">
      <button class="ghost">Notifications</button>
      <div class="user-pill" @click="logout" title="Se deconnecter">
        <span class="user-dot"></span>
        <span>{{ initials }}</span>
      </div>
    </div>
  </header>

  <main class="main">
    <slot />
  </main>

  <footer class="footer">
    <div>
      <strong>StreamKo</strong>
      <span>Streaming prive pour votre cercle</span>
    </div>
    <div class="footer-actions">
      <button class="ghost small">Support</button>
      <button class="ghost small">Parametres</button>
    </div>
  </footer>
</template>
