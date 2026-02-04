import { describe, it, expect } from 'bun:test'

describe('RouteErrorFallback', () => {
  it('exports RouteErrorFallback component', async () => {
    const module = await import('../../components/RouteErrorFallback')
    expect(typeof module.RouteErrorFallback).toBe('function')
  })

  it('exports FeedErrorFallback component', async () => {
    const module = await import('../../components/RouteErrorFallback')
    expect(typeof module.FeedErrorFallback).toBe('function')
  })

  it('RouteErrorFallback has correct function name', async () => {
    const { RouteErrorFallback } = await import('../../components/RouteErrorFallback')
    expect(RouteErrorFallback.name).toBe('RouteErrorFallback')
  })

  it('FeedErrorFallback has correct function name', async () => {
    const { FeedErrorFallback } = await import('../../components/RouteErrorFallback')
    expect(FeedErrorFallback.name).toBe('FeedErrorFallback')
  })
})
