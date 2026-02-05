import { api } from './client'

export interface User {
  id: string
  username: string
  displayName: string
  avatar?: string
  header?: string
  bio?: string
  location?: string
  website?: string
  role?: 'admin' | 'moderator' | 'member'
  disabledAt?: string | null
  createdAt: string
}

export interface MediaItem {
  url: string
  thumbnailUrl?: string
  width?: number | null
  height?: number | null
  duration?: number | null
  type: 'image' | 'video'
  sortOrder?: number
}

export interface PostAuthor {
  username: string
  displayName: string
  avatar?: string
}

export type ReactionType = 'love' | 'haha' | 'hugs' | 'celebrate'

export interface ReactionCounts {
  love?: number
  haha?: number
  hugs?: number
  celebrate?: number
}

export interface Post {
  id: string
  userId: string
  content: string
  media?: MediaItem[]
  mediaUrl?: string
  createdAt: string
  reactions: ReactionCounts
  userReaction: ReactionType | null
  comments: number
  author?: PostAuthor
  circleIds?: string[]
}

export interface Comment {
  id: string
  postId: string
  userId: string
  username: string
  displayName: string
  avatar?: string
  content: string
  createdAt: string
}

export interface Notification {
  id: string
  type: 'reaction' | 'comment' | 'follow' | 'invite'
  fromUserId: string
  fromUsername: string
  fromDisplayName: string
  fromAvatar?: string
  postId?: string
  read: boolean
  createdAt: string
}

export interface AuditEntry {
  id: string
  actionType: string
  targetType: string
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  actor: {
    id: string
    username: string
    displayName: string
  }
}

export interface Circle {
  id: string
  userId: string
  name: string
  color: string
  createdAt: string
  memberCount?: number
}

export interface CircleWithMembers extends Circle {
  owner?: {
    username: string
    displayName: string
    avatar?: string
  }
  members?: {
    id: string
    username: string
    displayName: string
    avatar?: string
    bio?: string
    joinedAt: string
  }[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface SignupRequest {
  email: string
  password: string
  username: string
  displayName: string
  inviteToken?: string
}

export const auth = {
  login: (data: LoginRequest) => api.post<User>('/auth/login', data),
  signup: (data: SignupRequest) => api.post<User>('/auth/signup', data),
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

export const users = {
  get: (id: string) => api.get<User>(`/users/${id}`),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
  followers: (id: string) => api.get<User[]>(`/users/${id}/followers`),
  following: (id: string) => api.get<User[]>(`/users/${id}/following`),
  follow: (id: string) => api.post(`/users/${id}/follow`),
  unfollow: (id: string) => api.delete(`/users/${id}/follow`),
  list: () => api.get<User[]>('/users'),
}

export interface ReactionResponse {
  success: boolean
  reactions: ReactionCounts
  userReaction: ReactionType | null
}

export const posts = {
  feed: (cursor?: string, circleId?: string) => {
    const params: Record<string, string> = {}
    if (cursor) params.cursor = cursor
    if (circleId) params.circleId = circleId
    return api.get<{ posts: Post[]; nextCursor?: string }>('/feed', { params })
  },
  get: (id: string) => api.get<Post>(`/posts/${id}`),
  create: (data: { content: string; media?: MediaItem[]; circleIds?: string[] }) => api.post<Post>('/posts', data),
  delete: (id: string) => api.delete(`/posts/${id}`),
  update: (id: string, content: string) => api.patch<Post>(`/posts/${id}`, { content }),
  react: (id: string, type: ReactionType) => api.post<ReactionResponse>(`/posts/${id}/reactions`, { type }),
  unreact: (id: string) => api.delete<ReactionResponse>(`/posts/${id}/reactions`),
  comments: (id: string) => api.get<Comment[]>(`/posts/${id}/comments`),
  addComment: (id: string, content: string) => api.post<Comment>(`/posts/${id}/comments`, { content }),
  deleteComment: (postId: string, commentId: string) => api.delete(`/posts/${postId}/comments/${commentId}`),
  userPosts: (userId: string) => api.get<Post[]>(`/users/${userId}/posts`),
}

export const notifications = {
  list: () => api.get<Notification[]>('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
}

export const search = {
  users: (query: string) => api.get<User[]>('/search/users', { params: { q: query } }),
  posts: (query: string) => api.get<Post[]>('/search/posts', { params: { q: query } }),
}

export const invites = {
  validate: (token: string) => api.get<{ valid: boolean; inviter?: User }>(`/invites/${token}`),
  create: () => api.post<{ token: string; expiresAt: string }>('/invites'),
  list: () =>
    api.get<
      {
        token: string
        used: boolean
        createdAt: string
        expiresAt?: string
        revokedAt?: string | null
        invitedBy?: User
        usedBy?: User
      }[]
    >('/invites'),
  revoke: (token: string) => api.post<{ token: string; revokedAt: string }>(`/invites/${token}/revoke`),
}

export const media = {
  presign: (data: { contentType: string; size: number }) =>
    api.post<{ uploadUrl: string; key: string; expiresIn: number }>('/media/presign', data),
  complete: (data: { key: string }) => api.post<MediaItem>('/media/complete', data),
}

export const circles = {
  list: () => api.get<Circle[]>('/circles'),
  get: (id: string) => api.get<CircleWithMembers>(`/circles/${id}`),
  create: (data: { name: string; color?: string }) => api.post<CircleWithMembers>('/circles', data),
  update: (id: string, data: { name?: string; color?: string }) => api.patch<CircleWithMembers>(`/circles/${id}`, data),
  delete: (id: string) => api.delete(`/circles/${id}`),
  addMembers: (id: string, userIds: number[]) => api.post<{ success: boolean; added: number }>(`/circles/${id}/members`, { userIds }),
  removeMember: (id: string, userId: string) => api.delete(`/circles/${id}/members/${userId}`),
}

export const admin = {
  users: () => api.get<User[]>('/admin/users'),
  stats: () => api.get<{ users: number; posts: number; invites: number }>('/admin/stats'),
  content: (params?: { cursor?: string; q?: string }) => {
    const queryParams: Record<string, string> = {}
    if (params?.cursor) queryParams.cursor = params.cursor
    if (params?.q) queryParams.q = params.q
    return api.get<{
      items: {
        type: 'post' | 'comment'
        id: string
        content: string
        createdAt: string
        author: {
          id: string
          username: string
          displayName: string
          avatar?: string
        }
        postId?: string
        postContent?: string
        postAuthor?: { username: string; displayName: string }
        commentsCount?: number
        mediaCount?: number
      }[]
      nextCursor?: string
    }>('/admin/content', { params: queryParams })
  },
  deleteContent: (id: string, type: 'post' | 'comment') =>
    api.post<{ success: true; type: 'post' | 'comment'; id: string; postId?: string }>(
      `/admin/content/${id}/delete`,
      { type }
    ),
  disableUser: (id: string) => api.post<{ id: string; disabledAt: string }>(`/admin/users/${id}/disable`),
  enableUser: (id: string) => api.post<{ id: string; disabledAt: null }>(`/admin/users/${id}/enable`),
  promoteUser: (id: string) => api.post<{ id: string; role: 'moderator' }>(`/admin/users/${id}/promote`),
  demoteUser: (id: string) => api.post<{ id: string; role: 'member' }>(`/admin/users/${id}/demote`),
  transferOwnership: (id: string) => api.post<{ id: string; role: 'admin' }>(`/admin/users/${id}/transfer`),
  removeUser: (id: string) => api.delete<{ success: true }>(`/admin/users/${id}`),
  auditLog: (params?: { cursor?: string; limit?: number }) => {
    const queryParams: Record<string, string> = {}
    if (params?.cursor) queryParams.cursor = params.cursor
    if (params?.limit) queryParams.limit = String(params.limit)
    return api.get<{
      items: AuditEntry[]
      nextCursor?: string
    }>('/admin/audit', { params: queryParams })
  },
  revokeUserSessions: (id: string) => api.post<{ success: true; id: string }>(`/admin/users/${id}/revoke-sessions`),
}

export interface ChatMessage {
  id: string
  userId: string
  username: string
  displayName: string
  avatar?: string
  content: string
  createdAt: string
}

export interface ChatPresenceResponse {
  online: number
  users: string[]
  joins: string[]
  leaves: string[]
}

export const chat = {
  messages: (since?: string) => {
    const params: Record<string, string> = {}
    if (since) params.since = since
    return api.get<{ messages: ChatMessage[] }>('/chat/messages', { params })
  },
  send: (content: string) => api.post<ChatMessage>('/chat/messages', { content }),
  presence: () => api.post<ChatPresenceResponse>('/chat/presence'),
  status: () => api.get<{ online: number }>('/chat/status'),
  leave: () => api.post('/chat/leave'),
}

export interface SettingsResponse {
  appName: string
  logoIcon: string
}

export const settings = {
  get: async (): Promise<SettingsResponse> => {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Failed to fetch settings");
    return res.json() as Promise<SettingsResponse>;
  },

  update: async (data: { appName?: string; logoIcon?: string }): Promise<SettingsResponse> => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = (await res.json()) as { error?: string };
      throw new Error(errorData.error || "Failed to update settings");
    }
    return res.json() as Promise<SettingsResponse>;
  },
}

export const setup = {
  status: () => api.get<{ needsSetup: boolean }>('/setup/status'),
  complete: (data: { email: string; password: string; username: string; displayName: string; appName?: string; logoIcon?: string }) =>
    api.post<{ user: User; success: boolean }>('/setup/complete', data),
}
