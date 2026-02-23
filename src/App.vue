<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import CatalogView from './components/CatalogView.vue'
import LoginView from './components/LoginView.vue'
import MovieDetailView from './components/MovieDetailView.vue'
import PlayerView from './components/PlayerView.vue'
import SeriesDetailView from './components/SeriesDetailView.vue'
import { clearAuthToken, findAuthToken, setAuthToken } from './lib/authToken'
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
  kind: PlayerKind
  mediaId: string | null
}

type PlayerKind = 'movie' | 'episode'
type PlayerBackTargetKind = 'movie' | 'series'
type PlayerBackTarget = {
  kind: PlayerBackTargetKind
  id: string
}

type AppRouteName = 'home' | 'catalog' | 'movie' | 'series' | 'login' | 'player'
type AppRoute = {
  name: AppRouteName
  movieId: string | null
  seriesId: string | null
  playerKind: PlayerKind | null
  playerId: string | null
}

type NavLinkAction = 'logout'

type NavLink = {
  label: string
  route?: '/' | '/catalog' | '/login'
  action?: NavLinkAction
}

const resolveRoute = (pathname: string): AppRoute => {
  if (pathname === '/login') {
    return { name: 'login', movieId: null, seriesId: null, playerKind: null, playerId: null }
  }

  if (pathname === '/catalog') {
    return { name: 'catalog', movieId: null, seriesId: null, playerKind: null, playerId: null }
  }

  const playerMatch = pathname.match(/^\/player\/(movie|episode)\/([^/]+)$/)
  if (playerMatch?.[1] && playerMatch?.[2]) {
    return {
      name: 'player',
      movieId: null,
      seriesId: null,
      playerKind: playerMatch[1] as PlayerKind,
      playerId: decodeURIComponent(playerMatch[2]),
    }
  }

  const movieMatch = pathname.match(/^\/movie\/([^/]+)$/)
  if (movieMatch?.[1]) {
    return {
      name: 'movie',
      movieId: decodeURIComponent(movieMatch[1]),
      seriesId: null,
      playerKind: null,
      playerId: null,
    }
  }

  const seriesMatch = pathname.match(/^\/series\/([^/]+)$/)
  if (seriesMatch?.[1]) {
    return {
      name: 'series',
      movieId: null,
      seriesId: decodeURIComponent(seriesMatch[1]),
      playerKind: null,
      playerId: null,
    }
  }

  return { name: 'home', movieId: null, seriesId: null, playerKind: null, playerId: null }
}

const routeToPath = (route: AppRoute): string => {
  if (route.name === 'catalog') {
    return '/catalog'
  }

  if (route.name === 'movie' && route.movieId) {
    return `/movie/${encodeURIComponent(route.movieId)}`
  }

  if (route.name === 'series' && route.seriesId) {
    return `/series/${encodeURIComponent(route.seriesId)}`
  }

  if (route.name === 'player' && route.playerKind && route.playerId) {
    return `/player/${route.playerKind}/${encodeURIComponent(route.playerId)}`
  }

  if (route.name === 'login') {
    return '/login'
  }

  return '/'
}

const isProtectedRoute = (route: AppRoute): boolean => route.name !== 'login'

const links: NavLink[] = [
  { label: 'Home', route: '/' },
  { label: 'Catalogue', route: '/catalog' },
  { label: 'Pour toi' },
  { label: 'Logout', action: 'logout' },
]

const authToken = ref<string | null>(findAuthToken())
const pendingRedirectPath = ref<string | null>(null)

const currentRoute = ref<AppRoute>(
  typeof window === 'undefined'
    ? { name: 'login', movieId: null, seriesId: null, playerKind: null, playerId: null }
    : resolveRoute(window.location.pathname),
)

const isLoginRoute = computed(() => currentRoute.value.name === 'login')
const isCatalogRoute = computed(() => currentRoute.value.name === 'catalog')
const isHomeRoute = computed(() => currentRoute.value.name === 'home')
const isMovieRoute = computed(() => currentRoute.value.name === 'movie')
const isSeriesRoute = computed(() => currentRoute.value.name === 'series')
const isPlayerRoute = computed(() => currentRoute.value.name === 'player')
const currentMovieId = computed(() => currentRoute.value.movieId)
const currentSeriesId = computed(() => currentRoute.value.seriesId)
const currentPlayerKind = computed<PlayerKind>(() => currentRoute.value.playerKind ?? 'movie')
const currentPlayerId = computed(() => currentRoute.value.playerId ?? '')
const showTopbar = computed(() => !isLoginRoute.value)

const syncRouteFromLocation = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  const requestedRoute = resolveRoute(window.location.pathname)

  if (!authToken.value && isProtectedRoute(requestedRoute)) {
    pendingRedirectPath.value = routeToPath(requestedRoute)
    if (window.location.pathname !== '/login') {
      window.history.replaceState({}, '', '/login')
    }
    currentRoute.value = { name: 'login', movieId: null, seriesId: null, playerKind: null, playerId: null }
    return
  }

  if (authToken.value && requestedRoute.name === 'login') {
    if (window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/')
    }
    currentRoute.value = { name: 'home', movieId: null, seriesId: null, playerKind: null, playerId: null }
    void loadHome()
    return
  }

  const nextRoute = requestedRoute
  const hasChanged =
    nextRoute.name !== currentRoute.value.name ||
    nextRoute.movieId !== currentRoute.value.movieId ||
    nextRoute.seriesId !== currentRoute.value.seriesId ||
    nextRoute.playerKind !== currentRoute.value.playerKind ||
    nextRoute.playerId !== currentRoute.value.playerId
  currentRoute.value = nextRoute

  if (hasChanged && nextRoute.name === 'home') {
    void loadHome()
  }
}

const navigateTo = (route?: '/' | '/catalog' | '/login'): void => {
  if (!route) {
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  if (route === '/login' && authToken.value) {
    navigateTo('/')
    return
  }

  const targetRoute = resolveRoute(route)

  if (!authToken.value && isProtectedRoute(targetRoute)) {
    pendingRedirectPath.value = route
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login')
    }
    currentRoute.value = { name: 'login', movieId: null, seriesId: null, playerKind: null, playerId: null }
    return
  }

  if (window.location.pathname === route && currentRoute.value.name === targetRoute.name) {
    if (route === '/') {
      void loadHome()
    }
    return
  }

  window.history.pushState({}, '', route)
  currentRoute.value = targetRoute

  if (route === '/') {
    void loadHome()
  }
}

const openMovieDetail = (movieId: string): void => {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedId = movieId.trim()
  if (!normalizedId) {
    return
  }

  const nextPath = `/movie/${encodeURIComponent(normalizedId)}`
  if (!authToken.value) {
    pendingRedirectPath.value = nextPath
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login')
    }
    currentRoute.value = { name: 'login', movieId: null, seriesId: null, playerKind: null, playerId: null }
    return
  }

  if (window.location.pathname === nextPath && currentRoute.value.name === 'movie') {
    return
  }

  window.history.pushState({}, '', nextPath)
  currentRoute.value = {
    name: 'movie',
    movieId: normalizedId,
    seriesId: null,
    playerKind: null,
    playerId: null,
  }
}

const openSeriesDetail = (seriesId: string): void => {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedId = seriesId.trim()
  if (!normalizedId) {
    return
  }

  const nextPath = `/series/${encodeURIComponent(normalizedId)}`
  if (!authToken.value) {
    pendingRedirectPath.value = nextPath
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login')
    }
    currentRoute.value = { name: 'login', movieId: null, seriesId: null, playerKind: null, playerId: null }
    return
  }

  if (window.location.pathname === nextPath && currentRoute.value.name === 'series') {
    return
  }

  window.history.pushState({}, '', nextPath)
  currentRoute.value = {
    name: 'series',
    movieId: null,
    seriesId: normalizedId,
    playerKind: null,
    playerId: null,
  }
}

const openPlayer = (kind: PlayerKind, mediaId: string): void => {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedId = mediaId.trim()
  if (!normalizedId) {
    return
  }

  const nextPath = `/player/${kind}/${encodeURIComponent(normalizedId)}`
  if (!authToken.value) {
    pendingRedirectPath.value = nextPath
    if (window.location.pathname !== '/login') {
      window.history.pushState({}, '', '/login')
    }
    currentRoute.value = { name: 'login', movieId: null, seriesId: null, playerKind: null, playerId: null }
    return
  }

  if (
    window.location.pathname === nextPath &&
    currentRoute.value.name === 'player' &&
    currentRoute.value.playerKind === kind &&
    currentRoute.value.playerId === normalizedId
  ) {
    return
  }

  window.history.pushState({}, '', nextPath)
  currentRoute.value = {
    name: 'player',
    movieId: null,
    seriesId: null,
    playerKind: kind,
    playerId: normalizedId,
  }
}

const isActiveRoute = (route?: '/' | '/catalog' | '/login'): boolean => {
  if (!route) {
    return false
  }

  if (route === '/') {
    return currentRoute.value.name === 'home'
  }

  if (route === '/login') {
    return currentRoute.value.name === 'login'
  }

  return (
    currentRoute.value.name === 'catalog' ||
    currentRoute.value.name === 'movie' ||
    currentRoute.value.name === 'series' ||
    currentRoute.value.name === 'player'
  )
}

const handleLoginSuccess = (token: string): void => {
  setAuthToken(token)
  authToken.value = token

  const destination = pendingRedirectPath.value ?? '/'
  pendingRedirectPath.value = null

  if (typeof window === 'undefined') {
    return
  }

  window.history.pushState({}, '', destination)
  currentRoute.value = resolveRoute(destination)

  if (currentRoute.value.name === 'home') {
    void loadHome()
  }
}

const logout = (): void => {
  clearAuthToken()
  authToken.value = null
  pendingRedirectPath.value = null
  releases.value = []
  continueWatching.value = []
  detectedGenres.value = []

  if (typeof window === 'undefined') {
    return
  }

  if (window.location.pathname !== '/login') {
    window.history.pushState({}, '', '/login')
  }
  currentRoute.value = { name: 'login', movieId: null, seriesId: null, playerKind: null, playerId: null }
}

const onNavLinkClick = (link: NavLink): void => {
  if (link.action === 'logout') {
    logout()
    return
  }

  navigateTo(link.route)
}

const openRelease = (release: Release): void => {
  if (release.kind === 'Movie') {
    openMovieDetail(release.id)
    return
  }

  openSeriesDetail(release.id)
}

const openContinueItem = (item: ContinueItem): void => {
  if (!item.mediaId) {
    return
  }

  if (item.kind === 'movie') {
    openPlayer('movie', item.mediaId)
    return
  }

  if (item.kind === 'episode') {
    openPlayer('episode', item.mediaId)
  }
}

const openCatalogMedia = (target: { kind: 'movie' | 'series'; id: string }): void => {
  if (target.kind === 'movie') {
    openMovieDetail(target.id)
    return
  }

  openSeriesDetail(target.id)
}

const handlePlayerBack = (target: PlayerBackTarget): void => {
  if (target.kind === 'movie') {
    openMovieDetail(target.id)
    return
  }

  openSeriesDetail(target.id)
}

const openFirstContinue = (): void => {
  const firstItem = continueWatching.value[0]
  if (firstItem) {
    openContinueItem(firstItem)
    return
  }

  navigateTo('/catalog')
}

const fallbackGenres = ['Drama', 'Sci-Fi', 'Thriller', 'Documentary', 'Comedy', 'Action']

const releases = ref<Release[]>([])
const continueWatching = ref<ContinueItem[]>([])
const detectedGenres = ref<string[]>([])
const loadingHome = ref(false)
const homeError = ref('')

const genres = computed(() => (detectedGenres.value.length > 0 ? detectedGenres.value : fallbackGenres))
const nowPlaying = computed(() => releases.value[0] ?? null)

const homeStatus = computed(() => {
  if (loadingHome.value) {
    return 'Loading data from Strapi...'
  }

  if (!authToken.value) {
    return 'You are logged out. Sign in to load home data from Strapi.'
  }

  if (homeError.value) {
    if (releases.value.length > 0 || continueWatching.value.length > 0) {
      return `Partial data loaded. ${homeError.value}`
    }

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
  const documentId = asString(getField(entity, 'documentId'))
  if (documentId) {
    return documentId
  }

  const id = asString(getField(entity, 'id'))
  if (id) {
    return id
  }

  return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`
}

const getEntityIdentifier = (entity: Record<string, unknown>): string => {
  const documentId = asString(getField(entity, 'documentId'))
  if (documentId) {
    return documentId
  }

  const id = asString(getField(entity, 'id'))
  return id
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

  const mediaId = getEntityIdentifier(entity)
  if (!mediaId) {
    return null
  }

  const publishedAt =
    parseTimestamp(getField(entity, 'publishedAt')) || parseTimestamp(getField(entity, 'createdAt'))

  const year = asNumber(getField(entity, 'year'))
  const seasonCount = getRelationEntities(entity, 'seasons').length

  return {
    id: mediaId,
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
        const mediaId = getEntityIdentifier(movieEntity) || null
        const updatedAt =
          parseTimestamp(getField(entity, 'updatedAt')) || parseTimestamp(getField(entity, 'createdAt'))

        return {
          id: getEntityId(entity, 'progress'),
          title,
          chapter: 'Movie',
          progress: normalizeProgressPercent(durationSeconds, positionSeconds),
          left: minutesLeft(durationSeconds, positionSeconds),
          updatedAt,
          kind: 'movie',
          mediaId,
        } satisfies ContinueItem
      }

      if (kind === 'episode' && episodeEntity) {
        const title = asString(getField(episodeEntity, 'title')) || 'Untitled episode'
        const mediaId = getEntityIdentifier(episodeEntity) || null
        const updatedAt =
          parseTimestamp(getField(entity, 'updatedAt')) || parseTimestamp(getField(entity, 'createdAt'))

        return {
          id: getEntityId(entity, 'progress'),
          title,
          chapter: buildEpisodeChapter(episodeEntity),
          progress: normalizeProgressPercent(durationSeconds, positionSeconds),
          left: minutesLeft(durationSeconds, positionSeconds),
          updatedAt,
          kind: 'episode',
          mediaId,
        } satisfies ContinueItem
      }

      return null
    })
    .filter((item): item is ContinueItem => item !== null)

  return items.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 12)
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

const formatHomeLoadError = (section: string, error: unknown): string => {
  if (error instanceof StrapiRequestError) {
    return `${section} API ${error.status}: ${error.message}`
  }

  return `${section} failed to load`
}

const loadHome = async (): Promise<void> => {
  loadingHome.value = true
  homeError.value = ''

  const token = findAuthToken()
  authToken.value = token

  if (!token) {
    releases.value = []
    continueWatching.value = []
    detectedGenres.value = []
    loadingHome.value = false
    return
  }

  const [moviesResult, seriesResult, progressResult] = await Promise.allSettled([
    streamyApi.getMovies({ token }),
    streamyApi.getSeries({ token }),
    streamyApi.getWatchProgresses({ token }),
  ])

  const homeErrors: string[] = []

  const movieEntities =
    moviesResult.status === 'fulfilled' ? toEntityArray(moviesResult.value) : (homeErrors.push(formatHomeLoadError('Movies', moviesResult.reason)), [])

  const seriesEntities =
    seriesResult.status === 'fulfilled' ? toEntityArray(seriesResult.value) : (homeErrors.push(formatHomeLoadError('Series', seriesResult.reason)), [])

  const progressEntities =
    progressResult.status === 'fulfilled'
      ? toEntityArray(progressResult.value)
      : (homeErrors.push(formatHomeLoadError('Progress', progressResult.reason)), [])

  releases.value = buildReleases(movieEntities, seriesEntities)
  continueWatching.value = buildContinueItems(progressEntities)
  detectedGenres.value = collectTopGenres([...movieEntities, ...seriesEntities])

  homeError.value = homeErrors.join(' | ')
  loadingHome.value = false

  if (homeErrors.length > 0 && releases.value.length === 0 && continueWatching.value.length === 0) {
    return
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', syncRouteFromLocation)
    syncRouteFromLocation()
  }

  if (currentRoute.value.name === 'home' && !loadingHome.value) {
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

    <header v-if="showTopbar" class="topbar">
      <div class="brand">
        <span class="brand-mark">SK</span>
        <span class="brand-name">StreamKo</span>
      </div>
      <nav class="nav-links">
        <a
          v-for="link in links"
          :key="`${link.label}-${link.route ?? link.action ?? 'disabled'}`"
          :href="link.route ?? '#'"
          :class="{ active: isActiveRoute(link.route), disabled: !link.route && !link.action }"
          @click.prevent="onNavLinkClick(link)"
        >
          {{ link.label }}
        </a>
      </nav>
      <button class="ghost-btn">Premium</button>
    </header>

    <LoginView v-if="isLoginRoute" @login-success="handleLoginSuccess" />

    <main v-else-if="isHomeRoute" class="layout">
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
          <button class="secondary-btn" type="button" @click="openFirstContinue">
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
            <div class="media-card-actions">
              <button
                type="button"
                class="home-card-btn"
                @click="openRelease(item)"
              >
                {{ item.kind === 'Movie' ? 'Open movie' : 'Open series' }}
              </button>
            </div>
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
            <div class="continue-actions">
              <button
                type="button"
                class="continue-resume-btn"
                :disabled="!item.mediaId"
                @click="openContinueItem(item)"
              >
                {{ item.kind === 'movie' ? 'Reprendre' : 'Resume episode' }}
              </button>
            </div>
          </article>
          <article v-if="!loadingHome && continueWatching.length === 0" class="continue-card empty-card">
            <h4>No active progress</h4>
            <p>Start a movie or an episode to see continue watching cards.</p>
          </article>
        </div>
      </section>
    </main>

    <CatalogView v-else-if="isCatalogRoute" @open-media="openCatalogMedia" />

    <MovieDetailView
      v-else-if="isMovieRoute && currentMovieId"
      :movie-id="currentMovieId"
      @back-to-catalog="navigateTo('/catalog')"
      @play-movie="openPlayer('movie', $event)"
    />

    <SeriesDetailView
      v-else-if="isSeriesRoute && currentSeriesId"
      :series-id="currentSeriesId"
      @back-to-catalog="navigateTo('/catalog')"
      @play-episode="openPlayer('episode', $event)"
    />

    <PlayerView
      v-else-if="isPlayerRoute && currentPlayerId"
      :kind="currentPlayerKind"
      :media-id="currentPlayerId"
      @back-to-detail="handlePlayerBack"
    />
  </div>
</template>
