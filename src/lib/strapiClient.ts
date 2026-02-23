import { withQuery, type StrapiQuery } from './strapiQuery'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type StrapiRequestOptions = {
  method?: HttpMethod
  token?: string
  query?: StrapiQuery
  body?: unknown
  signal?: AbortSignal
}

type StrapiErrorPayload = {
  data?: unknown
  error?: {
    status?: number
    name?: string
    message?: string
    details?: unknown
  }
}

const DEFAULT_API_URL = 'http://localhost:1337'
const envApiUrl = import.meta.env.VITE_API_URL
const STRAPI_API_URL = (envApiUrl || DEFAULT_API_URL).replace(/\/+$/, '')

export class StrapiRequestError extends Error {
  status: number
  payload: StrapiErrorPayload | null

  constructor(status: number, message: string, payload: StrapiErrorPayload | null) {
    super(message)
    this.name = 'StrapiRequestError'
    this.status = status
    this.payload = payload
  }
}

const toErrorMessage = (status: number, payload: StrapiErrorPayload | null): string => {
  const apiMessage = payload?.error?.message
  if (apiMessage) {
    return apiMessage
  }

  return `Strapi request failed with status ${status}`
}

const parseJson = (rawBody: string): StrapiErrorPayload | null => {
  if (!rawBody) {
    return null
  }

  try {
    return JSON.parse(rawBody) as StrapiErrorPayload
  } catch {
    return null
  }
}

export const strapiRequest = async <TResponse>(
  path: string,
  options: StrapiRequestOptions = {},
): Promise<TResponse> => {
  const method = options.method ?? 'GET'
  const url = `${STRAPI_API_URL}${withQuery(path, options.query)}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  const rawBody = await response.text()
  const payload = parseJson(rawBody)

  if (!response.ok) {
    throw new StrapiRequestError(response.status, toErrorMessage(response.status, payload), payload)
  }

  if (payload === null) {
    return null as TResponse
  }

  return payload as TResponse
}
