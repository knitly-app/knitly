const BASE_URL = '/api'

interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

class ApiError extends Error {
  status: number
  statusText: string
  body?: unknown

  constructor(status: number, statusText: string, body?: unknown) {
    super(`${status} ${statusText}`)
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...init } = options

  let url = `${BASE_URL}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init.headers,
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as unknown
    throw new ApiError(response.status, response.statusText, body)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data = (await response.json()) as unknown
  return data as T
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }),

  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(data) }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
}

export { ApiError }
