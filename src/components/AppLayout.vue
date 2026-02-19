<script setup lang="ts"></script>

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
      <div class="user-pill">
        <span class="user-dot"></span>
        <span>KC</span>
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
