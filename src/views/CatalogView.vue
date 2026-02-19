<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isSeries = computed(() => route.name === 'series')

const title = computed(() => (isSeries.value ? 'Series' : 'Films'))
const subtitle = computed(() =>
  isSeries.value ? 'Saisons, episodes, reprises' : 'Longs metrages en qualite premium'
)

const items = computed(() =>
  isSeries.value
    ? [
        { title: 'Night Meridian', meta: 'S3', badge: 'E08' },
        { title: 'Blue Paradox', meta: 'S1', badge: 'E02' },
        { title: 'Kite District', meta: 'S2', badge: 'E05' },
        { title: 'Atlas Code', meta: 'S1', badge: 'E09' },
        { title: 'Brass Room', meta: 'S4', badge: 'E01' },
        { title: 'Crimson Vale', meta: 'S2', badge: 'E07' },
        { title: 'Paper Lantern', meta: 'S1', badge: 'E03' },
        { title: 'Nocturne City', meta: 'S1', badge: 'E04' },
      ]
    : [
        { title: 'Silent Atlas', meta: '2h 08', badge: '4K' },
        { title: 'Glass Harbor', meta: '1h 42', badge: 'Nouveau' },
        { title: 'Velvet Run', meta: '2h 01', badge: 'VF' },
        { title: 'Opaline', meta: '1h 58', badge: 'VOSTFR' },
        { title: 'Pulse Theory', meta: '2h 12', badge: 'HDR' },
        { title: 'Cold Frame', meta: '1h 39', badge: '4K' },
        { title: 'Silverline', meta: '2h 04', badge: 'VF' },
        { title: 'Marelle', meta: '1h 46', badge: 'Nouveau' },
      ]
)

const filters = ['Tout', 'Action', 'Thriller', 'SF', 'Drame', '4K', 'VOSTFR']
</script>

<template>
  <section class="page-hero">
    <div>
      <div class="eyebrow">Catalogue</div>
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </div>
    <div class="hero-actions">
      <button class="ghost">Trier</button>
      <button class="ghost">Filtres</button>
    </div>
  </section>

  <section class="search-panel">
    <div class="search-box">
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14Zm0-2a9 9 0 1 0 5.6 16.1l4.1 4.1a1 1 0 0 0 1.4-1.4l-4.1-4.1A9 9 0 0 0 11 2Z"
          fill="currentColor"
        />
      </svg>
      <input type="text" placeholder="Rechercher dans le catalogue..." />
      <button class="ghost small">Filtres</button>
    </div>
    <div class="filter-row">
      <button v-for="filter in filters" :key="filter" class="chip">
        {{ filter }}
      </button>
    </div>
  </section>

  <section class="catalog-grid">
    <article v-for="item in items" :key="item.title" class="media-card">
      <div class="media-cover">
        <span class="badge">{{ item.badge }}</span>
      </div>
      <div class="media-info">
        <h3>{{ item.title }}</h3>
        <span>{{ item.meta }}</span>
      </div>
      <div class="card-actions">
        <button class="cta small">Ouvrir</button>
        <button class="ghost small">Ajouter</button>
      </div>
    </article>
  </section>
</template>
