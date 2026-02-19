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

export type StrapiCollection<T> = {
  data: Array<{ id: number; attributes: T }>
  meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } }
}

export type StrapiSingle<T> = {
  data: { id: number; attributes: T } | null
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

export const fetchMovie = (id: string) =>
  apiFetch<StrapiSingle<Movie>>(
    `/api/movies/${id}${toQuery({ 'populate[poster]': 'true', 'populate[videoSources]': 'true' })}`
  )

export const fetchSerie = (id: string) =>
  apiFetch<StrapiSingle<Serie>>(`/api/series/${id}${toQuery({ 'populate[poster]': 'true' })}`)

export const fetchEpisodesBySeries = (seriesId: string) =>
  apiFetch<StrapiCollection<Episode>>(
    `/api/episodes${toQuery({
      'filters[series][id][$eq]': seriesId,
      'pagination[pageSize]': 50,
      sort: 'number:asc',
    })}`
  )

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
