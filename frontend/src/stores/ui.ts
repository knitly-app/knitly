import { create } from 'zustand'

interface UIState {
  editingPostId: string | null
  setEditingPost: (id: string | null) => void

  showCreatePost: boolean
  openCreatePost: () => void
  closeCreatePost: () => void

  searchMode: 'people' | 'posts'
  setSearchMode: (mode: 'people' | 'posts') => void
}

export const useUIStore = create<UIState>((set) => ({
  editingPostId: null,
  setEditingPost: (id) => set({ editingPostId: id }),

  showCreatePost: false,
  openCreatePost: () => set({ showCreatePost: true }),
  closeCreatePost: () => set({ showCreatePost: false }),

  searchMode: 'people',
  setSearchMode: (mode) => set({ searchMode: mode }),
}))
