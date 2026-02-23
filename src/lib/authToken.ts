const COMMON_TOKEN_KEYS = ['streamko.jwt', 'streamy.jwt', 'auth.jwt', 'jwt', 'token'] as const
export const PRIMARY_AUTH_TOKEN_KEY = COMMON_TOKEN_KEYS[0]

export const setAuthToken = (token: string): void => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PRIMARY_AUTH_TOKEN_KEY, token)
}

export const clearAuthToken = (): void => {
  if (typeof window === 'undefined') {
    return
  }

  for (const key of COMMON_TOKEN_KEYS) {
    window.localStorage.removeItem(key)
  }
}

export const findAuthToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null
  }

  for (const key of COMMON_TOKEN_KEYS) {
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
