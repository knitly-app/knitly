import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'

const originalFetch = globalThis.fetch

describe('setup routing', () => {
  beforeEach(() => {
    mock.restore()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('setup API endpoints', () => {
    it('setup.status endpoint exists in endpoints.ts', async () => {
      const endpoints = await import('../api/endpoints')

      expect(endpoints.setup).toBeDefined()
      expect(typeof endpoints.setup.status).toBe('function')
    })

    it('setup.complete endpoint exists in endpoints.ts', async () => {
      const endpoints = await import('../api/endpoints')

      expect(endpoints.setup).toBeDefined()
      expect(typeof endpoints.setup.complete).toBe('function')
    })

    it('setup.status returns needsSetup boolean', async () => {
      globalThis.fetch = mock((url: string) => {
        if (url.includes('/api/setup/status')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ needsSetup: true }),
          } as Response)
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)
      })

      const { setup } = await import('../api/endpoints')
      const status = await setup.status()

      expect(typeof status.needsSetup).toBe('boolean')
      expect(status.needsSetup).toBe(true)
    })

    it('setup.complete accepts admin credentials and returns success', async () => {
      globalThis.fetch = mock((url: string, options?: RequestInit) => {
        if (url.includes('/api/setup/complete')) {
          const body = options?.body ? JSON.parse(options.body as string) : {}
          expect(body).toHaveProperty('email')
          expect(body).toHaveProperty('password')
          expect(body).toHaveProperty('username')
          expect(body).toHaveProperty('displayName')
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          } as Response)
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)
      })

      const { setup } = await import('../api/endpoints')
      const result = await setup.complete({
        email: 'admin@example.com',
        password: 'password123',
        username: 'admin',
        displayName: 'Admin',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('public route configuration', () => {
    it('/setup is included in PUBLIC_ROUTES constant', async () => {
      const { PUBLIC_ROUTES } = await import('../routes/constants')

      expect(PUBLIC_ROUTES).toContain('/setup')
    })
  })

  describe('setup route behavior', () => {
    it('getSetupStatus helper function exists', async () => {
      const { getSetupStatus } = await import('../routes/setup-guard')

      expect(typeof getSetupStatus).toBe('function')
    })

    it('shouldRedirectToSetup returns true when needsSetup is true', async () => {
      globalThis.fetch = mock((url: string) => {
        if (url.includes('/api/setup/status')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ needsSetup: true }),
          } as Response)
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)
      })

      const { shouldRedirectToSetup } = await import('../routes/setup-guard')
      const result = await shouldRedirectToSetup()

      expect(result).toBe(true)
    })

    it('shouldRedirectToSetup returns false when needsSetup is false', async () => {
      globalThis.fetch = mock((url: string) => {
        if (url.includes('/api/setup/status')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ needsSetup: false }),
          } as Response)
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response)
      })

      const { shouldRedirectToSetup } = await import('../routes/setup-guard')
      const result = await shouldRedirectToSetup()

      expect(result).toBe(false)
    })
  })
})
