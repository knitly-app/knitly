import { describe, it, expect } from 'bun:test'
import { securityHeaders } from './security.js'

function createMockContext() {
  const headers = {}
  return {
    header: (name, value) => { headers[name] = value },
    _headers: headers
  }
}

describe('securityHeaders middleware', () => {
  it('sets Content-Security-Policy header with correct value', async () => {
    const ctx = createMockContext()
    await securityHeaders(ctx, async () => {})

    expect(ctx._headers['Content-Security-Policy']).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'"
    )
  })

  it('sets X-Content-Type-Options to "nosniff"', async () => {
    const ctx = createMockContext()
    await securityHeaders(ctx, async () => {})

    expect(ctx._headers['X-Content-Type-Options']).toBe('nosniff')
  })

  it('sets X-Frame-Options to "DENY"', async () => {
    const ctx = createMockContext()
    await securityHeaders(ctx, async () => {})

    expect(ctx._headers['X-Frame-Options']).toBe('DENY')
  })

  it('sets Strict-Transport-Security with correct value', async () => {
    const ctx = createMockContext()
    await securityHeaders(ctx, async () => {})

    expect(ctx._headers['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains'
    )
  })

  it('sets Referrer-Policy to "strict-origin-when-cross-origin"', async () => {
    const ctx = createMockContext()
    await securityHeaders(ctx, async () => {})

    expect(ctx._headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('sets X-XSS-Protection to "0"', async () => {
    const ctx = createMockContext()
    await securityHeaders(ctx, async () => {})

    expect(ctx._headers['X-XSS-Protection']).toBe('0')
  })

  it('calls next() middleware', async () => {
    const ctx = createMockContext()
    let nextCalled = false

    await securityHeaders(ctx, async () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(true)
  })
})
