import { create } from 'zustand'

interface PreAttachedMedia {
  url: string
  type: 'image' | 'video'
}

interface UIState {
  editingPostId: string | null
  setEditingPost: (id: string | null) => void

  showCreatePost: boolean
  initialMedia: PreAttachedMedia | null
  openCreatePost: (opts?: { media?: PreAttachedMedia }) => void
  closeCreatePost: () => void

  searchMode: 'people' | 'posts'
  setSearchMode: (mode: 'people' | 'posts') => void
}

export const useUIStore = create<UIState>((set) => ({
  editingPostId: null,
  setEditingPost: (id) => set({ editingPostId: id }),

  showCreatePost: false,
  initialMedia: null,
  openCreatePost: (opts) => set({ showCreatePost: true, initialMedia: opts?.media ?? null }),
  closeCreatePost: () => set({ showCreatePost: false, initialMedia: null }),

  searchMode: 'people',
  setSearchMode: (mode) => set({ searchMode: mode }),
}))
