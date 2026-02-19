<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  fetchMovies,
  fetchSeries,
  resolveMediaUrl,
  unwrapEntity,
  unwrapId,
  type Movie,
  type Serie,
} from '../lib/strapi'

const route = useRoute()
const isSeries = computed(() => route.name === 'series')

const title = computed(() => (isSeries.value ? 'Series' : 'Films'))
const subtitle = computed(() =>
  isSeries.value ? 'Saisons, episodes, reprises' : 'Longs metrages en qualite premium'
)

const filters = ['Tout', 'Action', 'Thriller', 'SF', 'Drame', '4K', 'VOSTFR']

const query = ref('')
const items = ref<
  Array<{
    id: number
    title: string
    meta: string
    badge: string
    poster?: string
    detailType: 'movie' | 'serie'
  }>
>([])
const loading = ref(false)
const error = ref('')
let debounceId: number | undefined

const loadCatalog = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = isSeries.value ? await fetchSeries(query.value) : await fetchMovies(query.value)
    const mapped = response.data.map((entry) => {
      const item = unwrapEntity<Movie | Serie>(entry)
      return {
        id: unwrapId(entry),
        title: item.title,
        meta: isSeries.value
          ? 'Serie'
          : item.releaseDate
            ? item.releaseDate.slice(0, 4)
            : 'Film',
        badge: isSeries.value ? 'E01' : '4K',
        poster: resolveMediaUrl(item.poster),
        detailType: isSeries.value ? 'serie' : 'movie',
      }
    })
    items.value = mapped
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
}

onMounted(loadCatalog)

watch(
  () => [query.value, isSeries.value],
  () => {
    window.clearTimeout(debounceId)
    debounceId = window.setTimeout(loadCatalog, 300)
  }
)
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
      <input v-model="query" type="text" placeholder="Rechercher dans le catalogue..." />
      <button class="ghost small">Filtres</button>
    </div>
    <div class="filter-row">
      <button v-for="filter in filters" :key="filter" class="chip">
        {{ filter }}
      </button>
    </div>
  </section>

  <section v-if="error" class="section">
    <div class="empty-state">
      <strong>Impossible de charger le catalogue</strong>
      <span>{{ error }}</span>
    </div>
  </section>

  <section class="catalog-grid">
    <article v-for="item in items" :key="item.title" class="media-card">
      <div
        class="media-cover"
        :style="item.poster ? { backgroundImage: `url(${item.poster})` } : {}"
      >
        <span class="badge">{{ item.badge }}</span>
      </div>
      <div class="media-info">
        <h3>{{ item.title }}</h3>
        <span>{{ item.meta }}</span>
      </div>
      <div class="card-actions">
        <RouterLink
          class="cta small"
          :to="{ name: 'details', params: { type: item.detailType, id: item.id } }"
        >
          Ouvrir
        </RouterLink>
        <button class="ghost small">Ajouter</button>
      </div>
    </article>
    <div v-if="!loading && !items.length" class="empty-state">
      <strong>Aucun resultat</strong>
      <span>Essaie un autre filtre ou ajoute un titre dans le backoffice.</span>
    </div>
  </section>
</template>
