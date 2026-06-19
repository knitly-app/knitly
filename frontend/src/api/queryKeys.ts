// Single source of truth for TanStack Query cache keys. Builders return the
// tuple a query registers under; the bare-prefix builders (e.g. feed.all,
// posts.all) double as invalidation targets, since TanStack matches by prefix.

export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
    resetToken: (token: string) => ['auth', 'reset-token', token] as const,
    confirmEmail: (token: string) => ['confirm-email', token] as const,
  },
  feed: {
    all: () => ['feed'] as const,
    byCircle: (circleId?: string) =>
      (circleId ? ['feed', circleId] : ['feed']) as ['feed'] | ['feed', string],
  },
  posts: {
    all: () => ['posts'] as const,
    detail: (id: string) => ['posts', id] as const,
    comments: (id: string) => ['posts', id, 'comments'] as const,
  },
  users: {
    all: () => ['users'] as const,
    detail: (id: string) => ['users', id] as const,
    posts: (id: string) => ['users', id, 'posts'] as const,
    media: (id: string) => ['users', id, 'media'] as const,
  },
  circles: {
    all: () => ['circles'] as const,
    detail: (id: string) => ['circles', id] as const,
  },
  // Site-wide member directory (not a circle's members) — kept top-level so it
  // is not accidentally prefix-invalidated by circle mutations.
  members: () => ['members'] as const,
  notifications: () => ['notifications'] as const,
  chat: {
    messages: () => ['chat', 'messages'] as const,
    messagesAccumulated: () => ['chat', 'messages', 'accumulated'] as const,
    presence: () => ['chat', 'presence'] as const,
    status: () => ['chat', 'status'] as const,
  },
  search: {
    users: (query: string) => ['search', 'users', query] as const,
    posts: (query: string) => ['search', 'posts', query] as const,
    mentions: (query: string) => ['mention-search', query] as const,
  },
  invite: (token: string) => ['invite', token] as const,
  admin: {
    stats: () => ['admin', 'stats'] as const,
    users: () => ['admin', 'users'] as const,
    bots: () => ['admin', 'bots'] as const,
    invites: () => ['admin', 'invites'] as const,
    audit: () => ['admin', 'audit'] as const,
    content: (query?: string) =>
      (query ? ['admin', 'content', query] : ['admin', 'content']) as
        | ['admin', 'content']
        | ['admin', 'content', string],
  },
}
