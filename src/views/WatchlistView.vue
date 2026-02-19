<script setup lang="ts">
const items = [
  { title: 'Silent Atlas', meta: 'Film · 4K' },
  { title: 'Night Meridian', meta: 'S3 · E08' },
  { title: 'Glass Harbor', meta: 'Film · Nouveau' },
  { title: 'Kite District', meta: 'S2 · E05' },
  { title: 'Opaline', meta: 'Film · VOSTFR' },
  { title: 'Pulse Theory', meta: 'Film · HDR' },
]
</script>

<template>
  <section class="page-hero">
    <div>
      <div class="eyebrow">Ma liste</div>
      <h1>Votre selection privee</h1>
      <p>Retrouvez tous les films et series sauvegardes.</p>
    </div>
    <div class="hero-actions">
      <button class="ghost">Trier</button>
      <button class="ghost">Retirer</button>
    </div>
  </section>

  <section class="catalog-grid">
    <article v-for="item in items" :key="item.title" class="media-card">
      <div class="media-cover">
        <span class="badge">LISTE</span>
      </div>
      <div class="media-info">
        <h3>{{ item.title }}</h3>
        <span>{{ item.meta }}</span>
      </div>
      <div class="card-actions">
        <button class="cta small">Lire</button>
        <button class="ghost small">Retirer</button>
      </div>
    </article>
  </section>
</template>
