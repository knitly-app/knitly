import { describe, it, expect, beforeEach } from 'bun:test'
import { authRateLimit, searchRateLimit, generalRateLimit } from './rateLimit.js'

function createMockContext(ip = '127.0.0.1') {
  const headers = {}
  let nextCalled = false
  return {
    req: {
      header: (name) => {
        if (name === 'x-forwarded-for') return ip
        if (name === 'x-real-ip') return null
        return null
      },
      raw: { socket: { remoteAddress: ip } }
    },
    header: (name, value) => { headers[name] = value },
    json: (body, status) => ({ body, status }),
    _headers: headers,
    _nextCalled: () => nextCalled,
    _setNextCalled: () => { nextCalled = true }
  }
}

function createNext(ctx) {
  return async () => { ctx._setNextCalled() }
}

describe('rateLimit middleware', () => {
  describe('authRateLimit (5 requests/min)', () => {
    it('allows requests under threshold', async () => {
      const ip = `test-auth-under-${Date.now()}`
      const ctx = createMockContext(ip)
      const next = createNext(ctx)

      const result = await authRateLimit(ctx, next)

      expect(result).toBeUndefined()
      expect(ctx._nextCalled()).toBe(true)
    })

    it('returns 429 after exceeding threshold', async () => {
      const ip = `test-auth-exceed-${Date.now()}`

      for (let i = 0; i < 5; i++) {
        const ctx = createMockContext(ip)
        await authRateLimit(ctx, createNext(ctx))
      }

      const ctx = createMockContext(ip)
      const next = createNext(ctx)
      const result = await authRateLimit(ctx, next)

      expect(result.status).toBe(429)
      expect(result.body.error).toBe('Too many requests. Please try again later.')
      expect(ctx._nextCalled()).toBe(false)
    })

    it('sets X-RateLimit-Limit header correctly', async () => {
      const ip = `test-auth-limit-${Date.now()}`
      const ctx = createMockContext(ip)

      await authRateLimit(ctx, createNext(ctx))

      expect(ctx._headers['X-RateLimit-Limit']).toBe('5')
    })

    it('decrements X-RateLimit-Remaining', async () => {
      const ip = `test-auth-remaining-${Date.now()}`

      const ctx1 = createMockContext(ip)
      await authRateLimit(ctx1, createNext(ctx1))
      expect(ctx1._headers['X-RateLimit-Remaining']).toBe('4')

      const ctx2 = createMockContext(ip)
      await authRateLimit(ctx2, createNext(ctx2))
      expect(ctx2._headers['X-RateLimit-Remaining']).toBe('3')

      const ctx3 = createMockContext(ip)
      await authRateLimit(ctx3, createNext(ctx3))
      expect(ctx3._headers['X-RateLimit-Remaining']).toBe('2')
    })

    it('sets X-RateLimit-Reset header', async () => {
      const ip = `test-auth-reset-${Date.now()}`
      const ctx = createMockContext(ip)

      await authRateLimit(ctx, createNext(ctx))

      const reset = parseInt(ctx._headers['X-RateLimit-Reset'], 10)
      expect(reset).toBeGreaterThan(0)
      expect(reset).toBeLessThanOrEqual(60)
    })
  })

  describe('searchRateLimit (20 requests/min)', () => {
    it('allows requests under threshold', async () => {
      const ip = `test-search-under-${Date.now()}`
      const ctx = createMockContext(ip)
      const next = createNext(ctx)

      await searchRateLimit(ctx, next)

      expect(ctx._nextCalled()).toBe(true)
      expect(ctx._headers['X-RateLimit-Limit']).toBe('20')
    })

    it('returns 429 after exceeding 20 requests', async () => {
      const ip = `test-search-exceed-${Date.now()}`

      for (let i = 0; i < 20; i++) {
        const ctx = createMockContext(ip)
        await searchRateLimit(ctx, createNext(ctx))
      }

      const ctx = createMockContext(ip)
      const result = await searchRateLimit(ctx, createNext(ctx))

      expect(result.status).toBe(429)
    })
  })

  describe('generalRateLimit (100 requests/min)', () => {
    it('sets correct limit header', async () => {
      const ip = `test-general-${Date.now()}`
      const ctx = createMockContext(ip)

      await generalRateLimit(ctx, createNext(ctx))

      expect(ctx._headers['X-RateLimit-Limit']).toBe('100')
    })
  })

  describe('IP isolation', () => {
    it('different IPs have separate rate limits', async () => {
      const ip1 = `test-ip1-${Date.now()}`
      const ip2 = `test-ip2-${Date.now()}`

      for (let i = 0; i < 5; i++) {
        const ctx = createMockContext(ip1)
        await authRateLimit(ctx, createNext(ctx))
      }

      const ctx1 = createMockContext(ip1)
      const result1 = await authRateLimit(ctx1, createNext(ctx1))
      expect(result1.status).toBe(429)

      const ctx2 = createMockContext(ip2)
      const next2 = createNext(ctx2)
      const result2 = await authRateLimit(ctx2, next2)

      expect(result2).toBeUndefined()
      expect(ctx2._nextCalled()).toBe(true)
      expect(ctx2._headers['X-RateLimit-Remaining']).toBe('4')
    })
  })

  describe('IP extraction', () => {
    it('extracts IP from x-forwarded-for header', async () => {
      const forwardedIp = `forwarded-${Date.now()}`
      const ctx = createMockContext(forwardedIp)

      await authRateLimit(ctx, createNext(ctx))

      expect(ctx._headers['X-RateLimit-Remaining']).toBe('4')
    })

    it('handles comma-separated x-forwarded-for', async () => {
      const ip = `multi-forward-${Date.now()}`
      const headers = {}
      const ctx = {
        req: {
          header: (name) => {
            if (name === 'x-forwarded-for') return `${ip}, 10.0.0.1, 192.168.1.1`
            return null
          },
          raw: { socket: { remoteAddress: '127.0.0.1' } }
        },
        header: (name, value) => { headers[name] = value },
        json: (body, status) => ({ body, status }),
        _headers: headers
      }

      let nextCalled = false
      await authRateLimit(ctx, async () => { nextCalled = true })

      expect(nextCalled).toBe(true)

      for (let i = 0; i < 5; i++) {
        await authRateLimit(ctx, async () => {})
      }

      const result = await authRateLimit(ctx, async () => {})
      expect(result.status).toBe(429)
    })
  })
})
