<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { findAuthToken } from '../lib/authToken'
import { StrapiRequestError } from '../lib/strapiClient'
import { streamyApi } from '../lib/streamyApi'

const props = defineProps<{
  movieId: string
}>()

const emit = defineEmits<{
  backToCatalog: []
}>()

type MovieDetail = {
  id: string
  title: string
  year: number | null
  synopsis: string
  genres: string[]
  cast: string[]
  videoUrl: string | null
}

const loadingMovie = ref(false)
const detailError = ref('')
const activeToken = ref<string | null>(null)
const movie = ref<MovieDetail | null>(null)
const progressPosition = ref(0)
const progressCompleted = ref(false)

const genreList = computed(() => movie.value?.genres ?? [])
const castMembers = computed(() => movie.value?.cast ?? [])
const canPlay = computed(() => Boolean(movie.value?.videoUrl))
const shouldResume = computed(() => !progressCompleted.value && progressPosition.value > 30)
const ctaLabel = computed(() => (shouldResume.value ? 'Reprendre' : 'Regarder'))

const toClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remaining = safeSeconds % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

const detailStatus = computed(() => {
  if (loadingMovie.value) {
    return 'Loading movie details from Strapi...'
  }

  if (!activeToken.value) {
    return 'No JWT found in localStorage. Login flow will populate this in Sprint 1.'
  }

  if (detailError.value) {
    return detailError.value
  }

  if (!movie.value) {
    return 'Movie not found.'
  }

  if (!movie.value.videoUrl) {
    return 'No video linked for this movie yet.'
  }

  if (shouldResume.value) {
    return `Resume available at ${toClock(progressPosition.value)}.`
  }

  return 'Ready to start.'
})

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return ''
}

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const getField = (entity: Record<string, unknown>, key: string): unknown => {
  if (key in entity) {
    return entity[key]
  }

  const attributes = asRecord(entity.attributes)
  return attributes?.[key]
}

const unwrapRelation = (value: unknown): unknown => {
  const record = asRecord(value)

  if (!record) {
    return value
  }

  if ('data' in record) {
    return record.data
  }

  return value
}

const getRelationEntities = (entity: Record<string, unknown>, key: string): Record<string, unknown>[] => {
  const relationValue = unwrapRelation(getField(entity, key))

  if (Array.isArray(relationValue)) {
    return relationValue
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
  }

  const single = asRecord(relationValue)
  return single ? [single] : []
}

const toEntityArray = (response: unknown): Record<string, unknown>[] => {
  const payload = asRecord(response)
  const data = payload?.data

  if (Array.isArray(data)) {
    return data
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
  }

  const single = asRecord(data)
  return single ? [single] : []
}

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:1337').replace(/\/+$/, '')

const toAbsoluteMediaUrl = (url: string): string => {
  if (!url) {
    return ''
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  return url.startsWith('/') ? `${API_ORIGIN}${url}` : `${API_ORIGIN}/${url}`
}

const getEntityId = (entity: Record<string, unknown>): string => {
  const id = asString(getField(entity, 'id'))
  if (id) {
    return id
  }

  const documentId = asString(getField(entity, 'documentId'))
  if (documentId) {
    return documentId
  }

  return `movie-${Math.random().toString(36).slice(2, 8)}`
}

const toMovieDetail = (entity: Record<string, unknown>): MovieDetail | null => {
  const title = asString(getField(entity, 'title'))
  if (!title) {
    return null
  }

  const genres = getRelationEntities(entity, 'genres')
    .map((genreEntity) => asString(getField(genreEntity, 'name')))
    .filter((genreName) => genreName.length > 0)

  const cast = getRelationEntities(entity, 'cast')
    .map((personEntity) => asString(getField(personEntity, 'name')))
    .filter((personName) => personName.length > 0)

  const videoEntity = getRelationEntities(entity, 'video')[0]
  const videoUrl = videoEntity ? toAbsoluteMediaUrl(asString(getField(videoEntity, 'url'))) : ''

  return {
    id: getEntityId(entity),
    title,
    year: asNumber(getField(entity, 'year')),
    synopsis: asString(getField(entity, 'synopsis')),
    genres,
    cast,
    videoUrl: videoUrl || null,
  }
}

const matchesMovieId = (progressEntity: Record<string, unknown>, movieId: string): boolean => {
  const movieEntity = getRelationEntities(progressEntity, 'movie')[0]
  if (!movieEntity) {
    return false
  }

  const relationId = asString(getField(movieEntity, 'id'))
  const relationDocumentId = asString(getField(movieEntity, 'documentId'))

  if (relationId && relationId === movieId) {
    return true
  }

  if (relationDocumentId && relationDocumentId === movieId) {
    return true
  }

  const routeNumericId = Number(movieId)
  if (Number.isFinite(routeNumericId) && relationId) {
    return Number(relationId) === routeNumericId
  }

  return false
}

const loadMovieDetail = async (): Promise<void> => {
  loadingMovie.value = true
  detailError.value = ''
  movie.value = null
  progressPosition.value = 0
  progressCompleted.value = false

  const token = findAuthToken()
  activeToken.value = token

  if (!token) {
    loadingMovie.value = false
    return
  }

  try {
    const me = await streamyApi.getMe({ token })

    const [movieResponse, progressResponse] = await Promise.all([
      streamyApi.getMovieById(props.movieId, { token }),
      streamyApi.getWatchProgresses({ token, userId: me.id }),
    ])

    const movieEntity = toEntityArray(movieResponse)[0]
    if (!movieEntity) {
      detailError.value = 'Movie not found.'
      loadingMovie.value = false
      return
    }

    movie.value = toMovieDetail(movieEntity)
    if (!movie.value) {
      detailError.value = 'Movie payload is invalid.'
      loadingMovie.value = false
      return
    }

    const progressEntities = toEntityArray(progressResponse)
    const movieProgress = progressEntities.find((progressEntity) => {
      const kind = asString(getField(progressEntity, 'kind'))
      return kind === 'movie' && matchesMovieId(progressEntity, props.movieId)
    })

    if (movieProgress) {
      progressPosition.value = asNumber(getField(movieProgress, 'positionSeconds')) ?? 0
      progressCompleted.value = Boolean(getField(movieProgress, 'completed'))
    }
  } catch (error) {
    movie.value = null
    progressPosition.value = 0
    progressCompleted.value = false

    if (error instanceof StrapiRequestError) {
      detailError.value = `API ${error.status}: ${error.message}`
      loadingMovie.value = false
      return
    }

    detailError.value = 'Failed to load movie details from Strapi.'
  } finally {
    loadingMovie.value = false
  }
}

watch(
  () => props.movieId,
  () => {
    void loadMovieDetail()
  },
  { immediate: true },
)
</script>

<template>
  <main class="movie-layout">
    <section class="movie-hero reveal-1">
      <button type="button" class="movie-back-link" @click="emit('backToCatalog')">
        Back to catalogue
      </button>

      <p class="eyebrow">Movie detail</p>
      <h1>{{ movie?.title ?? 'Movie detail' }}</h1>

      <div class="movie-pill-row">
        <span class="movie-pill">{{ movie?.year ?? 'N/A' }}</span>
        <span v-for="genre in genreList" :key="genre" class="movie-pill">{{ genre }}</span>
      </div>

      <p class="hero-copy">
        {{ movie?.synopsis || 'No synopsis available for this movie yet.' }}
      </p>

      <p v-if="detailStatus" class="status-copy">{{ detailStatus }}</p>

      <div class="hero-actions">
        <button type="button" class="primary-btn" :disabled="!canPlay">
          {{ ctaLabel }}
        </button>
        <button type="button" class="secondary-btn" @click="emit('backToCatalog')">
          Return to catalogue
        </button>
      </div>
    </section>

    <section class="movie-side-panel reveal-2">
      <div class="panel-head">
        <h2>Cast</h2>
        <span>{{ castMembers.length }} member{{ castMembers.length > 1 ? 's' : '' }}</span>
      </div>

      <div class="movie-cast-list">
        <span v-for="person in castMembers" :key="person" class="movie-cast-chip">{{ person }}</span>
        <p v-if="castMembers.length === 0" class="movie-muted-copy">No cast assigned yet.</p>
      </div>

      <div class="movie-video-block">
        <p class="movie-video-title">Video source</p>
        <p class="movie-muted-copy">
          {{ movie?.videoUrl ? 'MP4 is linked and ready for player route.' : 'No MP4 linked in Strapi.' }}
        </p>
      </div>
    </section>
  </main>
</template>
