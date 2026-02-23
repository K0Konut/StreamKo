export const findAuthToken = (): string | null => {
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
