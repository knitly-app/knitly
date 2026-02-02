import { api } from './client'

export interface User {
  id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  createdAt: string
  followers?: number
  following?: number
  isFollowing?: boolean
}

export interface MediaItem {
  url: string
  width?: number | null
  height?: number | null
  type: 'image'
  sortOrder?: number
}

export interface PostAuthor {
  username: string
  displayName: string
  avatar?: string
}

export interface Post {
  id: string
  userId: string
  content: string
  media?: MediaItem[]
  mediaUrl?: string
  createdAt: string
  likes: number
  comments: number
  liked: boolean
  author?: PostAuthor
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
  type: 'like' | 'comment' | 'follow' | 'invite'
  fromUserId: string
  fromUsername: string
  fromDisplayName: string
  fromAvatar?: string
  postId?: string
  read: boolean
  createdAt: string
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

export const posts = {
  feed: (cursor?: string) => api.get<{ posts: Post[]; nextCursor?: string }>('/feed', { params: cursor ? { cursor } : undefined }),
  get: (id: string) => api.get<Post>(`/posts/${id}`),
  create: (data: { content: string; media?: MediaItem[] }) => api.post<Post>('/posts', data),
  delete: (id: string) => api.delete(`/posts/${id}`),
  like: (id: string) => api.post(`/posts/${id}/like`),
  unlike: (id: string) => api.delete(`/posts/${id}/like`),
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
  list: () => api.get<{ token: string; used: boolean; usedBy?: User }[]>('/invites'),
}

export const media = {
  presign: (data: { contentType: string; size: number }) =>
    api.post<{ uploadUrl: string; key: string; expiresIn: number }>('/media/presign', data),
  complete: (data: { key: string }) => api.post<MediaItem>('/media/complete', data),
}

export const admin = {
  users: () => api.get<User[]>('/admin/users'),
  stats: () => api.get<{ users: number; posts: number; invites: number }>('/admin/stats'),
}
