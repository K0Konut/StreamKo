const DEFAULT_URL = 'http://localhost:1337'

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_STRAPI_URL
  return envUrl ? envUrl.replace(/\/$/, '') : DEFAULT_URL
}

const getToken = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem('sk_token')
}

const toQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.append(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

const apiFetch = async <T>(path: string, options: RequestInit = {}) => {
  const baseUrl = getBaseUrl()
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error?.message || `Erreur API (${response.status})`)
  }

  return (await response.json()) as T
}

export type StrapiEntity<T> =
  | { id: number; documentId?: string; attributes: T }
  | (T & { id: number; documentId?: string })

export type StrapiCollection<T> = {
  data: Array<StrapiEntity<T>>
  meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } }
}

export type StrapiSingle<T> = {
  data: StrapiEntity<T> | null
}

export type MediaFile = {
  url: string
  alternativeText?: string
}

export type MediaRelation = {
  data: { id: number; attributes: MediaFile } | null
}

export type VideoSource = {
  file: MediaRelation
  quality?: string
  language?: string
}

export type Movie = {
  title: string
  slug?: string
  synopsis?: string
  genres?: unknown
  duration?: number
  releaseDate?: string
  poster?: MediaRelation
  videoSources?: VideoSource[]
}

export type Serie = {
  title: string
  slug?: string
  synopsis?: string
  genres?: unknown
  poster?: MediaRelation
}

export type Episode = {
  title: string
  synopsis?: string
  number?: number
  duration?: number
  series?: { data: { id: number; attributes: Serie } } | null
  season?: { data: { id: number; attributes: { number?: number } } } | null
  videoSources?: VideoSource[]
}

export type WatchProgress = {
  itemType: 'movie' | 'episode'
  positionSeconds?: number
  completed?: boolean
  lastWatchedAt?: string
  movie?: { data: { id: number; attributes: Movie } } | null
  episode?: { data: { id: number; attributes: Episode } } | null
}

export type WatchlistItem = {
  itemType: 'movie' | 'series'
  movie?: { data: { id: number; attributes: Movie } } | null
  series?: { data: { id: number; attributes: Serie } } | null
}

export const resolveMediaUrl = (media?: MediaRelation | null) => {
  const url = media?.data?.attributes?.url
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${getBaseUrl()}${url}`
}

export const unwrapEntity = <T>(entry: StrapiEntity<T>) =>
  'attributes' in entry ? entry.attributes : entry

export const unwrapSingle = <T>(payload: StrapiSingle<T>) => {
  const data = payload.data
  if (!data) return null
  return unwrapEntity<T>(data)
}

export const unwrapId = <T>(entry: StrapiEntity<T>) => (entry as { id: number }).id

export const unwrapDocumentId = <T>(entry: StrapiEntity<T>) =>
  (entry as { documentId?: string }).documentId

export const unwrapRelation = <T>(relation?: { data: StrapiEntity<T> | null } | null) => {
  const data = relation?.data
  if (!data) return null
  return unwrapEntity<T>(data)
}

const isNumericId = (value: string) => /^\d+$/.test(value)

const fetchById = <T>(base: string, id: string, populate?: string) => {
  const filters = isNumericId(id)
    ? { 'filters[id][$eq]': id }
    : { 'filters[documentId][$eq]': id }

  const query = toQuery({
    ...filters,
    ...(populate || {}),
    'pagination[pageSize]': 1,
  })

  return apiFetch<StrapiCollection<T>>(`${base}${query}`)
}

export const login = async (identifier: string, password: string) => {
  return apiFetch<{ jwt: string; user: { id: number; username: string; email: string } }>(
    '/api/auth/local',
    {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }
  )
}

export const fetchMovies = (search?: string) => {
  const query = toQuery({
    'filters[title][$containsi]': search,
    'populate[poster]': 'true',
    'pagination[pageSize]': 24,
    sort: 'releaseDate:desc',
  })
  return apiFetch<StrapiCollection<Movie>>(`/api/movies${query}`)
}

export const fetchSeries = (search?: string) => {
  const query = toQuery({
    'filters[title][$containsi]': search,
    'populate[poster]': 'true',
    'pagination[pageSize]': 24,
    sort: 'createdAt:desc',
  })
  return apiFetch<StrapiCollection<Serie>>(`/api/series${query}`)
}

export const fetchMovie = async (id: string) => {
  const response = await fetchById<Movie>('/api/movies', id, {
    'populate[poster]': 'true',
    'populate[videoSources]': 'true',
  })
  return response.data.length ? response.data[0] : null
}

export const fetchSerie = async (id: string) => {
  const response = await fetchById<Serie>('/api/series', id, {
    'populate[poster]': 'true',
  })
  return response.data.length ? response.data[0] : null
}

export const fetchEpisodesBySeries = (seriesId: string) => {
  const filters = isNumericId(seriesId)
    ? { 'filters[series][id][$eq]': seriesId }
    : { 'filters[series][documentId][$eq]': seriesId }

  return apiFetch<StrapiCollection<Episode>>(
    `/api/episodes${toQuery({
      ...filters,
      'pagination[pageSize]': 50,
      sort: 'number:asc',
    })}`
  )
}

export const fetchWatchProgress = () =>
  apiFetch<StrapiCollection<WatchProgress>>(
    `/api/watch-progresses${toQuery({
      'pagination[pageSize]': 8,
      sort: 'lastWatchedAt:desc',
      'populate[movie][populate][poster]': 'true',
      'populate[episode][populate][series][populate][poster]': 'true',
      'populate[episode][populate][season]': 'true',
    })}`
  )

export const fetchWatchlist = () =>
  apiFetch<StrapiCollection<WatchlistItem>>(
    `/api/watchlist-items${toQuery({
      'pagination[pageSize]': 24,
      'populate[movie][populate][poster]': 'true',
      'populate[series][populate][poster]': 'true',
    })}`
  )
