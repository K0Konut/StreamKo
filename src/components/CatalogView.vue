<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { findAuthToken } from '../lib/authToken'
import { StrapiRequestError } from '../lib/strapiClient'
import { streamyApi } from '../lib/streamyApi'

type CatalogMovie = {
  id: string
  title: string
  year: number | null
  genres: string[]
  synopsis: string
  publishedAt: number
}

const emit = defineEmits<{
  openMovie: [movieId: string]
}>()

const loadingCatalog = ref(false)
const catalogError = ref('')
const activeToken = ref<string | null>(null)
const movies = ref<CatalogMovie[]>([])

const searchQuery = ref('')
const selectedGenre = ref('all')
const yearFrom = ref('')
const yearTo = ref('')
const sortBy = ref<'recent' | 'az'>('recent')
const pageSize = ref(20)
const currentPage = ref(1)

const parseYearInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 1888) {
    return null
  }

  return parsed
}

const yearFromValue = computed(() => parseYearInput(yearFrom.value))
const yearToValue = computed(() => parseYearInput(yearTo.value))

const catalogStatus = computed(() => {
  if (loadingCatalog.value) {
    return 'Loading catalogue from Strapi...'
  }

  if (!activeToken.value) {
    return 'You are logged out. Sign in to load the catalogue from Strapi.'
  }

  if (catalogError.value) {
    return catalogError.value
  }

  return ''
})

const genreOptions = computed(() => {
  const counts = new Map<string, number>()

  movies.value.forEach((movie) => {
    movie.genres.forEach((genre) => {
      counts.set(genre, (counts.get(genre) ?? 0) + 1)
    })
  })

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([genre]) => genre)
})

const filteredMovies = computed(() => {
  const titleQuery = searchQuery.value.trim().toLowerCase()

  const filtered = movies.value.filter((movie) => {
    if (titleQuery && !movie.title.toLowerCase().includes(titleQuery)) {
      return false
    }

    if (selectedGenre.value !== 'all' && !movie.genres.includes(selectedGenre.value)) {
      return false
    }

    if (yearFromValue.value !== null && (movie.year === null || movie.year < yearFromValue.value)) {
      return false
    }

    if (yearToValue.value !== null && (movie.year === null || movie.year > yearToValue.value)) {
      return false
    }

    return true
  })

  filtered.sort((left, right) => {
    if (sortBy.value === 'az') {
      return left.title.localeCompare(right.title)
    }

    return right.publishedAt - left.publishedAt
  })

  return filtered
})

const totalPages = computed(() => {
  const safePageSize = Math.max(1, pageSize.value)
  return Math.max(1, Math.ceil(filteredMovies.value.length / safePageSize))
})

const paginatedMovies = computed(() => {
  const safePageSize = Math.max(1, pageSize.value)
  const startIndex = (currentPage.value - 1) * safePageSize
  return filteredMovies.value.slice(startIndex, startIndex + safePageSize)
})

watch(
  [searchQuery, selectedGenre, yearFrom, yearTo, sortBy, pageSize],
  () => {
    currentPage.value = 1
  },
  { deep: false },
)

watch(totalPages, (nextTotalPages) => {
  if (currentPage.value > nextTotalPages) {
    currentPage.value = nextTotalPages
  }
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

const parseTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return 0
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

const getEntityId = (entity: Record<string, unknown>): string => {
  const documentId = asString(getField(entity, 'documentId'))
  if (documentId) {
    return documentId
  }

  const id = asString(getField(entity, 'id'))
  if (id) {
    return id
  }

  return ''
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

const toCatalogMovie = (entity: Record<string, unknown>): CatalogMovie | null => {
  const title = asString(getField(entity, 'title'))
  if (!title) {
    return null
  }

  const entityId = getEntityId(entity)
  if (!entityId) {
    return null
  }

  const genres = getRelationEntities(entity, 'genres')
    .map((genreEntity) => asString(getField(genreEntity, 'name')))
    .filter((genreName) => genreName.length > 0)

  return {
    id: entityId,
    title,
    year: asNumber(getField(entity, 'year')),
    genres,
    synopsis: asString(getField(entity, 'synopsis')),
    publishedAt:
      parseTimestamp(getField(entity, 'publishedAt')) || parseTimestamp(getField(entity, 'createdAt')),
  }
}

const loadCatalog = async (): Promise<void> => {
  loadingCatalog.value = true
  catalogError.value = ''

  const token = findAuthToken()
  activeToken.value = token

  if (!token) {
    movies.value = []
    loadingCatalog.value = false
    return
  }

  try {
    const response = await streamyApi.getMovies({ token })
    const entities = toEntityArray(response)

    movies.value = entities
      .map((entity) => toCatalogMovie(entity))
      .filter((movie): movie is CatalogMovie => movie !== null)
  } catch (error) {
    movies.value = []

    if (error instanceof StrapiRequestError) {
      catalogError.value = `API ${error.status}: ${error.message}`
      loadingCatalog.value = false
      return
    }

    catalogError.value = 'Failed to load catalogue data from Strapi.'
  } finally {
    loadingCatalog.value = false
  }
}

const nextPage = (): void => {
  if (currentPage.value < totalPages.value) {
    currentPage.value += 1
  }
}

const previousPage = (): void => {
  if (currentPage.value > 1) {
    currentPage.value -= 1
  }
}

const openMovieDetails = (movieId: string): void => {
  emit('openMovie', movieId)
}

onMounted(() => {
  void loadCatalog()
})
</script>

<template>
  <main class="catalog-layout">
    <section class="catalog-hero reveal-1">
      <p class="eyebrow">Catalogue</p>
      <h1>All Movies</h1>
      <p class="hero-copy">
        Movie list is connected to Strapi. Use filters to quickly narrow by title, genre and year.
      </p>
      <p v-if="catalogStatus" class="status-copy">{{ catalogStatus }}</p>
    </section>

    <section class="catalog-filters reveal-2">
      <div class="catalog-filter-grid">
        <label class="filter-block">
          <span>Search title</span>
          <input v-model="searchQuery" class="filter-input" type="text" placeholder="Ex: Smoke Test Movie" />
        </label>

        <label class="filter-block">
          <span>Genre</span>
          <select v-model="selectedGenre" class="filter-input">
            <option value="all">All genres</option>
            <option v-for="genre in genreOptions" :key="genre" :value="genre">{{ genre }}</option>
          </select>
        </label>

        <label class="filter-block">
          <span>Year from</span>
          <input v-model="yearFrom" class="filter-input" type="number" min="1888" max="2100" placeholder="2000" />
        </label>

        <label class="filter-block">
          <span>Year to</span>
          <input v-model="yearTo" class="filter-input" type="number" min="1888" max="2100" placeholder="2026" />
        </label>

        <label class="filter-block">
          <span>Sort</span>
          <select v-model="sortBy" class="filter-input">
            <option value="recent">Recent</option>
            <option value="az">A-Z</option>
          </select>
        </label>

        <label class="filter-block">
          <span>Page size</span>
          <select v-model.number="pageSize" class="filter-input">
            <option :value="20">20</option>
            <option :value="40">40</option>
          </select>
        </label>
      </div>

      <div class="catalog-meta-row">
        <p>{{ filteredMovies.length }} movies match your filters.</p>
        <p>Page {{ currentPage }} / {{ totalPages }}</p>
      </div>
    </section>

    <section class="catalog-grid">
      <article v-for="movie in paginatedMovies" :key="movie.id" class="catalog-card">
        <div class="catalog-cover"></div>
        <div class="catalog-card-head">
          <h4>{{ movie.title }}</h4>
          <span>{{ movie.year ?? 'N/A' }}</span>
        </div>
        <p class="catalog-genres">
          {{ movie.genres.length > 0 ? movie.genres.join(' • ') : 'No genre assigned' }}
        </p>
        <p class="catalog-synopsis">{{ movie.synopsis || 'No synopsis available yet.' }}</p>
        <div class="catalog-card-actions">
          <button type="button" class="catalog-open-btn" @click="openMovieDetails(movie.id)">
            Open details
          </button>
        </div>
      </article>

      <article v-if="!loadingCatalog && paginatedMovies.length === 0" class="catalog-card catalog-empty-card">
        <h4>No movie found</h4>
        <p>Adjust filters or publish movie entries in Strapi.</p>
      </article>
    </section>

    <div class="catalog-pagination" aria-label="Catalogue pagination controls">
      <button type="button" :disabled="currentPage <= 1" @click="previousPage">Prev</button>
      <span>{{ currentPage }} / {{ totalPages }}</span>
      <button type="button" :disabled="currentPage >= totalPages" @click="nextPage">Next</button>
    </div>
  </main>
</template>
