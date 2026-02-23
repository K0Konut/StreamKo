<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import CatalogView from './components/CatalogView.vue'
import { StrapiRequestError } from './lib/strapiClient'
import { streamyApi } from './lib/streamyApi'

type Release = {
  id: string
  title: string
  year: number | null
  kind: 'Movie' | 'Series'
  meta: string
  label: string
  publishedAt: number
}

type ContinueItem = {
  id: string
  title: string
  chapter: string
  progress: number
  left: string
  updatedAt: number
}

type AppRoute = '/' | '/catalog'

type NavLink = {
  label: string
  route?: AppRoute
}

const resolveRoute = (pathname: string): AppRoute => (pathname === '/catalog' ? '/catalog' : '/')

const links: NavLink[] = [
  { label: 'Home', route: '/' },
  { label: 'Catalogue', route: '/catalog' },
  { label: 'Pour toi' },
  { label: 'Logout' },
]

const currentRoute = ref<AppRoute>(
  typeof window === 'undefined' ? '/' : resolveRoute(window.location.pathname),
)

const isCatalogRoute = computed(() => currentRoute.value === '/catalog')
const isHomeRoute = computed(() => !isCatalogRoute.value)

const syncRouteFromLocation = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  const nextRoute = resolveRoute(window.location.pathname)
  const hasChanged = nextRoute !== currentRoute.value
  currentRoute.value = nextRoute

  if (hasChanged && nextRoute === '/') {
    void loadHome()
  }
}

const navigateTo = (route?: AppRoute): void => {
  if (!route) {
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  if (currentRoute.value === route && window.location.pathname === route) {
    return
  }

  window.history.pushState({}, '', route)
  currentRoute.value = route

  if (route === '/') {
    void loadHome()
  }
}

const isActiveRoute = (route?: AppRoute): boolean => (route ? currentRoute.value === route : false)
const fallbackGenres = ['Drama', 'Sci-Fi', 'Thriller', 'Documentary', 'Comedy', 'Action']

const releases = ref<Release[]>([])
const continueWatching = ref<ContinueItem[]>([])
const detectedGenres = ref<string[]>([])
const loadingHome = ref(false)
const homeError = ref('')
const activeToken = ref<string | null>(null)

const genres = computed(() => (detectedGenres.value.length > 0 ? detectedGenres.value : fallbackGenres))
const nowPlaying = computed(() => releases.value[0] ?? null)

const homeStatus = computed(() => {
  if (loadingHome.value) {
    return 'Loading data from Strapi...'
  }

  if (!activeToken.value) {
    return 'No JWT found in localStorage. Login flow will populate this in Sprint 1.'
  }

  if (homeError.value) {
    return homeError.value
  }

  if (releases.value.length === 0 && continueWatching.value.length === 0) {
    return 'No media available for this account yet.'
  }

  return ''
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

const getEntityId = (entity: Record<string, unknown>, fallbackPrefix: string): string => {
  const id = asString(getField(entity, 'id'))
  if (id) {
    return id
  }

  const documentId = asString(getField(entity, 'documentId'))
  if (documentId) {
    return documentId
  }

  return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`
}

const topLabelFor = (kind: 'Movie' | 'Series', publishedAt: number): string => {
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000
  if (publishedAt > 0 && Date.now() - publishedAt <= twoWeeksMs) {
    return 'New'
  }

  return kind === 'Movie' ? 'Film' : 'Series'
}

const buildRelease = (entity: Record<string, unknown>, kind: 'Movie' | 'Series'): Release | null => {
  const title = asString(getField(entity, 'title'))
  if (!title) {
    return null
  }

  const publishedAt =
    parseTimestamp(getField(entity, 'publishedAt')) || parseTimestamp(getField(entity, 'createdAt'))

  const year = asNumber(getField(entity, 'year'))
  const seasonCount = getRelationEntities(entity, 'seasons').length

  return {
    id: getEntityId(entity, kind.toLowerCase()),
    title,
    year,
    kind,
    meta: kind === 'Movie' ? 'Movie' : seasonCount > 0 ? `S${seasonCount}` : 'Series',
    label: topLabelFor(kind, publishedAt),
    publishedAt,
  }
}

const buildReleases = (
  movieEntities: Record<string, unknown>[],
  seriesEntities: Record<string, unknown>[],
): Release[] => {
  const builtMovies = movieEntities
    .map((entity) => buildRelease(entity, 'Movie'))
    .filter((entity): entity is Release => entity !== null)

  const builtSeries = seriesEntities
    .map((entity) => buildRelease(entity, 'Series'))
    .filter((entity): entity is Release => entity !== null)

  return [...builtMovies, ...builtSeries]
    .sort((left, right) => right.publishedAt - left.publishedAt)
    .slice(0, 12)
}

const minutesLeft = (durationSeconds: number | null, positionSeconds: number): string => {
  if (!durationSeconds || durationSeconds <= positionSeconds) {
    const watched = Math.max(1, Math.round(positionSeconds / 60))
    return `${watched}m watched`
  }

  const remaining = Math.max(1, Math.ceil((durationSeconds - positionSeconds) / 60))
  return `${remaining}m left`
}

const normalizeProgressPercent = (durationSeconds: number | null, positionSeconds: number): number => {
  if (!durationSeconds || durationSeconds <= 0) {
    return Math.min(95, Math.max(5, Math.round(positionSeconds / 30)))
  }

  return Math.min(99, Math.max(1, Math.round((positionSeconds / durationSeconds) * 100)))
}

const buildEpisodeChapter = (episodeEntity: Record<string, unknown>): string => {
  const season = getRelationEntities(episodeEntity, 'season')[0]
  const seasonNumber = season ? asNumber(getField(season, 'number')) : null
  const episodeNumber = asNumber(getField(episodeEntity, 'number'))
  const episodeTitle = asString(getField(episodeEntity, 'title'))

  let prefix = 'Episode'
  if (seasonNumber !== null && episodeNumber !== null) {
    prefix = `S${seasonNumber}:E${episodeNumber}`
  } else if (episodeNumber !== null) {
    prefix = `Episode ${episodeNumber}`
  }

  return episodeTitle ? `${prefix} - ${episodeTitle}` : prefix
}

const buildContinueItems = (progressEntities: Record<string, unknown>[]): ContinueItem[] => {
  const items = progressEntities
    .map((entity) => {
      const completed = Boolean(getField(entity, 'completed'))
      const positionSeconds = asNumber(getField(entity, 'positionSeconds')) ?? 0
      const durationSeconds = asNumber(getField(entity, 'durationSeconds'))

      if (completed || positionSeconds <= 0) {
        return null
      }

      const kind = asString(getField(entity, 'kind'))
      const movieEntity = getRelationEntities(entity, 'movie')[0]
      const episodeEntity = getRelationEntities(entity, 'episode')[0]

      if (kind === 'movie' && movieEntity) {
        const title = asString(getField(movieEntity, 'title')) || 'Untitled movie'
        const updatedAt =
          parseTimestamp(getField(entity, 'updatedAt')) || parseTimestamp(getField(entity, 'createdAt'))

        return {
          id: getEntityId(entity, 'progress'),
          title,
          chapter: 'Movie',
          progress: normalizeProgressPercent(durationSeconds, positionSeconds),
          left: minutesLeft(durationSeconds, positionSeconds),
          updatedAt,
        } satisfies ContinueItem
      }

      if (kind === 'episode' && episodeEntity) {
        const title = asString(getField(episodeEntity, 'title')) || 'Untitled episode'
        const updatedAt =
          parseTimestamp(getField(entity, 'updatedAt')) || parseTimestamp(getField(entity, 'createdAt'))

        return {
          id: getEntityId(entity, 'progress'),
          title,
          chapter: buildEpisodeChapter(episodeEntity),
          progress: normalizeProgressPercent(durationSeconds, positionSeconds),
          left: minutesLeft(durationSeconds, positionSeconds),
          updatedAt,
        } satisfies ContinueItem
      }

      return null
    })
    .filter((item): item is ContinueItem => item !== null)

  return items.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 12)
}

const findTokenInLocalStorage = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const commonKeys = ['streamko.jwt', 'streamy.jwt', 'auth.jwt', 'jwt', 'token']
  for (const key of commonKeys) {
    const value = window.localStorage.getItem(key)
    if (value) {
      return value
    }
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key) {
      continue
    }

    const value = window.localStorage.getItem(key)
    if (!value) {
      continue
    }

    if (value.split('.').length === 3) {
      return value
    }
  }

  return null
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

const collectTopGenres = (entities: Record<string, unknown>[]): string[] => {
  const counts = new Map<string, number>()

  entities.forEach((entity) => {
    const genreEntities = getRelationEntities(entity, 'genres')
    genreEntities.forEach((genreEntity) => {
      const genreName = asString(getField(genreEntity, 'name'))
      if (!genreName) {
        return
      }

      counts.set(genreName, (counts.get(genreName) ?? 0) + 1)
    })
  })

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([genre]) => genre)
    .slice(0, 6)
}

const loadHome = async (): Promise<void> => {
  loadingHome.value = true
  homeError.value = ''

  const token = findTokenInLocalStorage()
  activeToken.value = token

  if (!token) {
    releases.value = []
    continueWatching.value = []
    detectedGenres.value = []
    loadingHome.value = false
    return
  }

  try {
    const me = await streamyApi.getMe({ token })

    const [moviesResponse, seriesResponse, progressResponse] = await Promise.all([
      streamyApi.getMovies({ token }),
      streamyApi.getSeries({ token }),
      streamyApi.getWatchProgresses({ token, userId: me.id }),
    ])

    const movieEntities = toEntityArray(moviesResponse)
    const seriesEntities = toEntityArray(seriesResponse)
    const progressEntities = toEntityArray(progressResponse)

    releases.value = buildReleases(movieEntities, seriesEntities)
    continueWatching.value = buildContinueItems(progressEntities)
    detectedGenres.value = collectTopGenres([...movieEntities, ...seriesEntities])
  } catch (error) {
    releases.value = []
    continueWatching.value = []
    detectedGenres.value = []

    if (error instanceof StrapiRequestError) {
      homeError.value = `API ${error.status}: ${error.message}`
      loadingHome.value = false
      return
    }

    homeError.value = 'Failed to load home data from Strapi.'
  } finally {
    loadingHome.value = false
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', syncRouteFromLocation)
    syncRouteFromLocation()
  }

  if (currentRoute.value === '/') {
    void loadHome()
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('popstate', syncRouteFromLocation)
  }
})
</script>

<template>
  <div class="app-shell">
    <div class="shape shape-amber" aria-hidden="true"></div>
    <div class="shape shape-ink" aria-hidden="true"></div>

    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">SK</span>
        <span class="brand-name">StreamKo</span>
      </div>
      <nav class="nav-links">
        <a
          v-for="link in links"
          :key="`${link.label}-${link.route ?? 'disabled'}`"
          :href="link.route ?? '#'"
          :class="{ active: isActiveRoute(link.route), disabled: !link.route }"
          @click.prevent="navigateTo(link.route)"
        >
          {{ link.label }}
        </a>
      </nav>
      <button class="ghost-btn">Premium</button>
    </header>

    <main v-if="isHomeRoute" class="layout">
      <section class="hero reveal-1">
        <p class="eyebrow">MVP Online</p>
        <h1>Cinematic streaming, with a premium surface.</h1>
        <p class="hero-copy">
          Home now reads live data from Strapi for new releases and continue watching.
        </p>
        <p v-if="homeStatus" class="status-copy">{{ homeStatus }}</p>
        <div class="hero-actions">
          <button class="primary-btn" type="button" @click="navigateTo('/catalog')">
            Open Catalogue
          </button>
          <button class="secondary-btn" type="button" @click="navigateTo('/catalog')">
            Continue Watching
          </button>
        </div>
      </section>

      <section class="panel reveal-2">
        <div class="panel-head">
          <h2>Now Playing</h2>
          <span>{{ nowPlaying?.label ?? 'Preview' }}</span>
        </div>
        <div class="panel-card">
          <div class="poster"></div>
          <div>
            <p class="panel-title">{{ nowPlaying?.title ?? 'No media selected' }}</p>
            <p class="panel-sub">
              {{ nowPlaying ? `${nowPlaying.kind}, ${nowPlaying.year ?? 'N/A'}` : 'Waiting for API data' }}
            </p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h3>Filter by vibe</h3>
          <a href="#">See all</a>
        </div>
        <div class="chip-row">
          <button v-for="genre in genres" :key="genre" class="chip">{{ genre }}</button>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h3>Nouveautes</h3>
          <a href="#">Explore</a>
        </div>
        <div class="rail">
          <article
            v-for="(item, idx) in releases"
            :key="item.id"
            class="media-card"
            :style="{ '--delay': `${idx * 80}ms` }"
          >
            <div class="media-cover"></div>
            <div class="media-meta">
              <span>{{ item.kind }}</span>
              <span>{{ item.meta }}</span>
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.year ?? 'N/A' }}</p>
            <span class="badge">{{ item.label }}</span>
          </article>
          <article v-if="!loadingHome && releases.length === 0" class="media-card empty-card">
            <h4>No releases yet</h4>
            <p>Publish movies or series in Strapi to feed this rail.</p>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h3>Reprendre</h3>
          <a href="#">Full history</a>
        </div>
        <div class="continue-grid">
          <article
            v-for="(item, idx) in continueWatching"
            :key="item.id"
            class="continue-card"
            :style="{ '--delay': `${idx * 90}ms` }"
          >
            <div class="continue-line">
              <h4>{{ item.title }}</h4>
              <span>{{ item.left }}</span>
            </div>
            <p>{{ item.chapter }}</p>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: `${item.progress}%` }"></div>
            </div>
          </article>
          <article v-if="!loadingHome && continueWatching.length === 0" class="continue-card empty-card">
            <h4>No active progress</h4>
            <p>Start a movie or an episode to see continue watching cards.</p>
          </article>
        </div>
      </section>
    </main>

    <CatalogView v-else />
  </div>
</template>
