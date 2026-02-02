import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { api, ApiError } from '../../api/client'

const originalFetch = globalThis.fetch

describe('api client', () => {
  beforeEach(() => {
    mock.restore()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('makes GET requests with credentials', async () => {
    const mockResponse = { id: '1', name: 'Test' }
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    )

    const result = await api.get('/users/1')

    expect(fetch).toHaveBeenCalledWith('/api/users/1', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    expect(result).toEqual(mockResponse)
  })

  it('makes POST requests with body', async () => {
    const payload = { email: 'test@test.com', password: 'pass' }
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'abc' }),
      } as Response)
    )

    await api.post('/auth/login', payload)

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
  })

  it('throws ApiError on non-ok response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'invalid credentials' }),
      } as Response)
    )

    expect(api.get('/auth/me')).rejects.toThrow(ApiError)
  })

  it('handles 204 No Content', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 204,
      } as Response)
    )

    const result = await api.delete('/posts/1')

    expect(result).toBeUndefined()
  })

  it('serializes query params', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    )

    await api.get('/search/users', { params: { q: 'mike' } })

    expect(fetch).toHaveBeenCalledWith('/api/search/users?q=mike', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
  })
})
