import { describe, it, expect } from 'bun:test'
import { getAvatarUrl } from '../../utils/avatar'

describe('getAvatarUrl', () => {
  it('returns explicit avatar when provided', () => {
    const url = getAvatarUrl({ id: 'user-1', avatar: 'https://cdn.example.com/avatar.png' })
    expect(url).toBe('https://cdn.example.com/avatar.png')
  })

  it('falls back to dicebear when avatar missing', () => {
    const url = getAvatarUrl({ id: 'user-2' })
    expect(url).toBe('https://api.dicebear.com/7.x/avataaars/svg?seed=user-2')
  })
})
