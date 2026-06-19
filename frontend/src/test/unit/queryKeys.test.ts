import { describe, it, expect } from 'bun:test'
import { queryKeys } from '../../api/queryKeys'

describe('queryKeys', () => {
  it('builds stable post keys', () => {
    expect(queryKeys.posts.all()).toEqual(['posts'])
    expect(queryKeys.posts.detail('5')).toEqual(['posts', '5'])
    expect(queryKeys.posts.comments('5')).toEqual(['posts', '5', 'comments'])
  })

  it('feed.byCircle falls back to the bare prefix without a circle', () => {
    expect(queryKeys.feed.all()).toEqual(['feed'])
    expect(queryKeys.feed.byCircle()).toEqual(['feed'])
    expect(queryKeys.feed.byCircle('3')).toEqual(['feed', '3'])
  })

  it('the bare prefix is a strict prefix of the scoped key (invalidation contract)', () => {
    const scoped = queryKeys.feed.byCircle('3')
    const prefix = queryKeys.feed.all()
    expect(scoped.slice(0, prefix.length)).toEqual([...prefix])
  })

  it('builds user sub-resource keys', () => {
    expect(queryKeys.users.detail('7')).toEqual(['users', '7'])
    expect(queryKeys.users.posts('7')).toEqual(['users', '7', 'posts'])
    expect(queryKeys.users.media('7')).toEqual(['users', '7', 'media'])
  })

  it('builds admin keys with optional content query', () => {
    expect(queryKeys.admin.stats()).toEqual(['admin', 'stats'])
    expect(queryKeys.admin.content()).toEqual(['admin', 'content'])
    expect(queryKeys.admin.content('spam')).toEqual(['admin', 'content', 'spam'])
  })

  it('builds chat and search keys', () => {
    expect(queryKeys.chat.messagesAccumulated()).toEqual(['chat', 'messages', 'accumulated'])
    expect(queryKeys.search.users('bob')).toEqual(['search', 'users', 'bob'])
    expect(queryKeys.search.mentions('bo')).toEqual(['mention-search', 'bo'])
  })
})
