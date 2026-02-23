export type StrapiPrimitive = string | number | boolean | null
export type StrapiQueryNode = StrapiPrimitive | ReadonlyArray<StrapiQueryNode> | StrapiQuery
export interface StrapiQuery {
  [key: string]: StrapiQueryNode | undefined
}

const appendQueryValue = (
  params: URLSearchParams,
  key: string,
  value: StrapiQueryNode | undefined,
): void => {
  if (value === undefined) {
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      appendQueryValue(params, `${key}[${index}]`, entry)
    })
    return
  }

  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => {
      appendQueryValue(params, `${key}[${childKey}]`, childValue)
    })
    return
  }

  params.append(key, String(value))
}

export const buildStrapiQueryString = (query?: StrapiQuery): string => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    appendQueryValue(params, key, value)
  })

  return params.toString()
}

export const withQuery = (path: string, query?: StrapiQuery): string => {
  const queryString = buildStrapiQueryString(query)
  if (!queryString) {
    return path
  }

  const hasQuery = path.includes('?')
  return `${path}${hasQuery ? '&' : '?'}${queryString}`
}
