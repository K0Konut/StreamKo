<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  fetchMovie,
  fetchSerie,
  fetchEpisodesBySeries,
  resolveMediaUrl,
  unwrapEntity,
  type Episode,
  type Movie,
  type Serie,
} from '../lib/strapi'

const route = useRoute()
const type = computed(() => String(route.params.type || 'movie'))
const isSeries = computed(() => type.value === 'serie')
const item = ref<Movie | Serie | null>(null)
const episodes = ref<Episode[]>([])
const poster = ref<string | null>(null)
const loading = ref(false)
const error = ref('')

const loadDetails = async () => {
  loading.value = true
  error.value = ''
  try {
    if (isSeries.value) {
      const response = await fetchSerie(String(route.params.id))
      item.value = response ? unwrapEntity<Serie>(response) : null
      poster.value = resolveMediaUrl(item.value?.poster || null)
      const episodesResponse = await fetchEpisodesBySeries(String(route.params.id))
      episodes.value = episodesResponse.data.map((entry) => unwrapEntity<Episode>(entry))
    } else {
      const response = await fetchMovie(String(route.params.id))
      item.value = response ? unwrapEntity<Movie>(response) : null
      poster.value = resolveMediaUrl(item.value?.poster || null)
      episodes.value = []
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
}

onMounted(loadDetails)
watch(() => route.params.id, loadDetails)
</script>

<template>
  <section v-if="error" class="section">
    <div class="empty-state">
      <strong>Impossible de charger la fiche</strong>
      <span>{{ error }}</span>
    </div>
  </section>

  <section class="detail-hero" v-if="item">
    <div class="detail-backdrop"></div>
    <div class="detail-content">
      <div class="eyebrow">Fiche</div>
      <h1>{{ item.title }}</h1>
      <p class="detail-meta">{{ isSeries ? 'Serie' : 'Film' }}</p>
      <p class="detail-desc">
        {{ item.synopsis || 'Aucune description pour le moment.' }}
      </p>
      <div class="hero-actions">
        <button class="cta">Lire</button>
        <button class="ghost">Ajouter a ma liste</button>
      </div>
    </div>
    <aside class="detail-card">
      <div class="media-cover" :style="poster ? { backgroundImage: `url(${poster})` } : {}"></div>
      <div class="detail-stats">
        <div>
          <span class="meta-label">Qualite</span>
          <span class="meta-value">4K / HDR</span>
        </div>
        <div>
          <span class="meta-label">Audio</span>
          <span class="meta-value">VF / VOSTFR</span>
        </div>
      </div>
    </aside>
  </section>

  <section v-if="isSeries && episodes.length" class="section">
    <div class="section-head">
      <h2>Episodes</h2>
      <button class="ghost small">Saison 1</button>
    </div>
    <div class="episode-list">
      <article v-for="episode in episodes" :key="episode.title" class="episode-row">
        <div>
          <h3>{{ episode.title }}</h3>
          <span>{{ episode.duration ? `${episode.duration} min` : '' }}</span>
        </div>
        <button class="ghost small">Lire</button>
      </article>
    </div>
  </section>

  <section class="section" v-if="loading">
    <div class="empty-state">
      <strong>Chargement...</strong>
      <span>Recuperation des details.</span>
    </div>
  </section>
</template>
