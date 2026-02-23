import { strapiRequest } from './strapiClient'
import type { StrapiQuery } from './strapiQuery'

export type StrapiListResponse<TData = unknown> = {
  data: TData[]
  meta?: {
    pagination?: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

export type StrapiSingleResponse<TData = unknown> = {
  data: TData
  meta?: Record<string, never>
}

export type StrapiUserMeResponse = {
  id: number
  username: string
  email: string
  confirmed: boolean
  blocked: boolean
}

type TokenOptions = {
  token: string
  signal?: AbortSignal
}

type UpdateWatchProgressInput = {
  kind?: 'movie' | 'episode'
  movie?: number | null
  episode?: number | null
  positionSeconds?: number
  durationSeconds?: number
  completed?: boolean
}

type CreateWatchProgressInput = {
  kind: 'movie' | 'episode'
  movie?: number | null
  episode?: number | null
  positionSeconds: number
  durationSeconds?: number
  completed?: boolean
}

const MOVIE_POPULATE = ['poster', 'genres', 'cast', 'video'] as const
const SERIES_POPULATE = ['poster', 'genres', 'cast'] as const
const SERIES_WITH_EPISODES_POPULATE = [
  ...SERIES_POPULATE,
  {
    seasons: {
      populate: ['episodes'],
    },
  },
] as const
const WATCH_PROGRESS_POPULATE = ['movie', 'episode'] as const

const buildWatchProgressQuery = (userId?: number): StrapiQuery => {
  const base: StrapiQuery = { populate: WATCH_PROGRESS_POPULATE }

  if (userId === undefined) {
    return base
  }

  return {
    ...base,
    filters: {
      user: {
        id: {
          $eq: userId,
        },
      },
    },
  }
}

export const streamyApi = {
  login(identifier: string, password: string, signal?: AbortSignal) {
    return strapiRequest<{
      jwt: string
      user: {
        id: number
        username: string
        email: string
      }
    }>('/api/auth/local', {
      method: 'POST',
      body: { identifier, password },
      signal,
    })
  },

  getMe(options: TokenOptions) {
    return strapiRequest<StrapiUserMeResponse>('/api/users/me', {
      token: options.token,
      signal: options.signal,
    })
  },

  getMovies(options: TokenOptions) {
    return strapiRequest<StrapiListResponse>('/api/movies', {
      token: options.token,
      query: {
        populate: MOVIE_POPULATE,
      },
      signal: options.signal,
    })
  },

  getMovieById(id: number | string, options: TokenOptions) {
    return strapiRequest<StrapiSingleResponse>(`/api/movies/${id}`, {
      token: options.token,
      query: {
        populate: MOVIE_POPULATE,
      },
      signal: options.signal,
    })
  },

  getSeries(options: TokenOptions) {
    return strapiRequest<StrapiListResponse>('/api/series', {
      token: options.token,
      query: {
        populate: SERIES_WITH_EPISODES_POPULATE,
      },
      signal: options.signal,
    })
  },

  getSeriesById(id: number | string, options: TokenOptions) {
    return strapiRequest<StrapiSingleResponse>(`/api/series/${id}`, {
      token: options.token,
      query: {
        populate: SERIES_WITH_EPISODES_POPULATE,
      },
      signal: options.signal,
    })
  },

  getEpisodeById(id: number | string, options: TokenOptions) {
    return strapiRequest<StrapiSingleResponse>(`/api/episodes/${id}`, {
      token: options.token,
      query: {
        populate: ['video'],
      },
      signal: options.signal,
    })
  },

  getWatchProgresses(options: TokenOptions & { userId?: number }) {
    return strapiRequest<StrapiListResponse>('/api/watch-progresses', {
      token: options.token,
      query: buildWatchProgressQuery(options.userId),
      signal: options.signal,
    })
  },

  createWatchProgress(input: CreateWatchProgressInput, options: TokenOptions) {
    return strapiRequest<StrapiSingleResponse>('/api/watch-progresses', {
      method: 'POST',
      token: options.token,
      body: {
        data: input,
      },
      signal: options.signal,
    })
  },

  updateWatchProgress(
    id: number | string,
    input: UpdateWatchProgressInput,
    options: TokenOptions,
  ) {
    return strapiRequest<StrapiSingleResponse>(`/api/watch-progresses/${id}`, {
      method: 'PUT',
      token: options.token,
      body: {
        data: input,
      },
      signal: options.signal,
    })
  },
}

export const streamyPopulate = {
  movie: MOVIE_POPULATE,
  series: SERIES_WITH_EPISODES_POPULATE,
  watchProgress: WATCH_PROGRESS_POPULATE,
} as const
