<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  fetchWatchlist,
  resolveMediaUrl,
  unwrapEntity,
  unwrapRelation,
  type WatchlistItem,
  type Movie,
  type Serie,
} from '../lib/strapi'

const items = ref<
  Array<{
    id: string
    title: string
    meta: string
    badge: string
    poster?: string
    detailType: 'movie' | 'serie'
  }>
>([])
const loading = ref(false)
const error = ref('')

const loadWatchlist = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetchWatchlist()
    items.value = response.data
      .map((entry) => unwrapEntity<WatchlistItem>(entry))
      .map((entry) => {
        if (entry.itemType === 'movie') {
          const movie = unwrapRelation<Movie>(entry.movie)
          if (!movie || !entry.movie?.data) return null
          return {
            id: String(entry.movie.data.documentId ?? entry.movie.data.id),
            title: movie.title,
            meta: 'Film',
            badge: 'LISTE',
            poster: resolveMediaUrl(movie.poster),
            detailType: 'movie',
          }
        }
        if (entry.itemType === 'series') {
          const serie = unwrapRelation<Serie>(entry.series)
          if (!serie || !entry.series?.data) return null
          return {
            id: String(entry.series.data.documentId ?? entry.series.data.id),
            title: serie.title,
            meta: 'Serie',
            badge: 'LISTE',
            poster: resolveMediaUrl(serie.poster),
            detailType: 'serie',
          }
        }
        return null
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
}

onMounted(loadWatchlist)
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

  <section v-if="error" class="section">
    <div class="empty-state">
      <strong>Impossible de charger la liste</strong>
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
        <button class="ghost small">Retirer</button>
      </div>
    </article>
    <div v-if="!loading && !items.length" class="empty-state">
      <strong>Liste vide</strong>
      <span>Ajoute un film ou une serie depuis le catalogue.</span>
    </div>
  </section>
</template>
