<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  fetchMovies,
  fetchSeries,
  fetchWatchProgress,
  resolveMediaUrl,
  unwrapEntity,
  unwrapRelation,
  type Movie,
  type Serie,
  type WatchProgress,
} from '../lib/strapi'

const loading = ref(true)
const error = ref('')
const continueWatching = ref<
  Array<{ title: string; meta: string; progress: number; timeLeft: string; poster?: string }>
>([])
const rails = ref<
  Array<{ title: string; items: Array<{ title: string; tag: string; year: string; badge: string }> }>
>([])

const filters = ['Tout', 'Films', 'Series', 'Anime', 'Documentaires', '4K', 'VOSTFR']

const formatTimeLeft = (seconds?: number, duration?: number) => {
  if (!seconds || !duration) return 'En cours'
  const remaining = Math.max(duration * 60 - seconds, 0)
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')} restantes`
  return `${minutes} min restantes`
}

const toRailItem = (item: Movie | Serie, badge: string, tagFallback: string) => ({
  title: item.title,
  tag: Array.isArray(item.genres) && item.genres.length ? String(item.genres[0]) : tagFallback,
  year: item.releaseDate ? item.releaseDate.slice(0, 4) : '2024',
  badge,
})

const mapProgress = (progress: WatchProgress) => {
  if (progress.itemType === 'movie') {
    const movie = unwrapRelation<Movie>(progress.movie)
    if (!movie) return null
    return {
      title: movie.title,
      meta: 'Film',
      progress: movie.duration ? (progress.positionSeconds || 0) / (movie.duration * 60) : 0,
      timeLeft: formatTimeLeft(progress.positionSeconds, movie.duration),
      poster: resolveMediaUrl(movie.poster),
    }
  }

  if (progress.itemType === 'episode') {
    const episode = unwrapRelation<Episode>(progress.episode)
    if (!episode) return null
    const serie = unwrapRelation<Serie>(episode.series)
    const metaLabel = serie ? serie.title : 'Episode'
    return {
      title: episode.title,
      meta: metaLabel,
      progress: episode.duration ? (progress.positionSeconds || 0) / (episode.duration * 60) : 0,
      timeLeft: formatTimeLeft(progress.positionSeconds, episode.duration),
      poster: resolveMediaUrl(serie?.poster),
    }
  }

  return null
}

const loadHome = async () => {
  loading.value = true
  error.value = ''
  try {
    const [moviesResponse, seriesResponse, progressResponse] = await Promise.all([
      fetchMovies(),
      fetchSeries(),
      fetchWatchProgress(),
    ])

    const movies = moviesResponse.data.map((item) => unwrapEntity<Movie>(item))
    const series = seriesResponse.data.map((item) => unwrapEntity<Serie>(item))

    rails.value = [
      {
        title: 'Tendances',
        items: movies.slice(0, 5).map((movie) => toRailItem(movie, 'Nouveau', 'Thriller')),
      },
      {
        title: 'Series a reprendre',
        items: series.slice(0, 5).map((serie) => toRailItem(serie, 'E01', 'Mystere')),
      },
      {
        title: 'Ajoutes recemment',
        items: movies.slice(5, 10).map((movie) => toRailItem(movie, '4K', 'Drame')),
      },
    ]

    continueWatching.value = progressResponse.data
      .map((item) => mapProgress(unwrapEntity<WatchProgress>(item)))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
}

onMounted(loadHome)
</script>

<template>
  <section class="hero">
    <div class="hero-content">
      <div class="eyebrow">Reprenez exactement ou vous etiez</div>
      <h1>
        Votre cinema prive,
        <span class="accent">sans compromis</span>
      </h1>
      <p>
        Un catalogue maitrise, des reprises instantanees et une experience fluide pour toi et ton entourage.
        Recherchez, filtrez, sauvegardez, regardez.
      </p>
      <div class="hero-actions">
        <button class="cta">Commencer</button>
        <button class="ghost">Parcourir le catalogue</button>
      </div>
      <div class="hero-meta">
        <div>
          <span class="meta-label">Qualite</span>
          <span class="meta-value">4K / HDR / VOSTFR</span>
        </div>
        <div>
          <span class="meta-label">Acces</span>
          <span class="meta-value">100% prive - comptes geres</span>
        </div>
      </div>
    </div>

    <div class="hero-card">
      <div class="card-header">
        <span class="pill">Continue watching</span>
        <span class="time">Maintenant</span>
      </div>
      <h3>{{ continueWatching[0]?.title || 'Aucune reprise' }}</h3>
      <p>{{ continueWatching[0]?.meta || 'Film - Serie' }}</p>
      <div class="progress">
        <div class="progress-bar" :style="{ width: `${(continueWatching[0]?.progress || 0) * 100}%` }"></div>
      </div>
      <div class="card-actions">
        <button class="cta small">Reprendre</button>
        <button class="ghost small">Details</button>
      </div>
      <div class="card-foot">
        <span>{{ continueWatching[0]?.timeLeft || 'En attente' }}</span>
        <span>Derniere lecture: hier</span>
      </div>
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
      <input type="text" placeholder="Rechercher un film, une serie, un genre..." />
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
      <strong>Impossible de charger les donnees</strong>
      <span>{{ error }}</span>
    </div>
  </section>

  <section class="section" style="--delay: 0.1s">
    <div class="section-head">
      <h2>Reprendre</h2>
      <span class="section-sub">Progression sauvegardee automatiquement</span>
    </div>
    <div class="continue-grid">
      <article v-for="item in continueWatching" :key="item.title" class="continue-card">
        <div class="card-media" :style="item.poster ? { backgroundImage: `url(${item.poster})` } : {}"></div>
        <div class="card-info">
          <h3>{{ item.title }}</h3>
          <span>{{ item.meta }}</span>
          <div class="progress">
            <div class="progress-bar" :style="{ width: `${item.progress * 100}%` }"></div>
          </div>
          <p>{{ item.timeLeft }}</p>
        </div>
      </article>
    </div>
    <div v-if="!loading && !continueWatching.length" class="empty-state">
      <strong>Aucune reprise pour l'instant</strong>
      <span>Commence un film ou une serie pour activer la reprise.</span>
    </div>
  </section>

  <section
    v-for="(rail, index) in rails"
    :key="rail.title"
    class="section"
    :style="{ '--delay': `${0.2 + index * 0.08}s` }"
  >
    <div class="section-head">
      <h2>{{ rail.title }}</h2>
      <button class="ghost small">Voir tout</button>
    </div>
    <div class="rail">
      <article v-for="item in rail.items" :key="item.title" class="media-card">
        <div class="media-cover">
          <span class="badge">{{ item.badge }}</span>
        </div>
        <div class="media-info">
          <h3>{{ item.title }}</h3>
          <span>{{ item.tag }} - {{ item.year }}</span>
        </div>
      </article>
    </div>
  </section>
</template>
