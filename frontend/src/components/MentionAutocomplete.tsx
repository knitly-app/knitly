import { useState, useRef, useImperativeHandle, forwardRef } from 'preact/compat'
import { useQuery } from '@tanstack/react-query'
import { search as searchApi, type User } from '../api/endpoints'
import { getAvatarUrl } from '../utils/avatar'

export interface MentionAutocompleteHandle {
  handleKeyDown: (e: KeyboardEvent) => boolean
}

interface MentionAutocompleteProps {
  query: string
  onSelect: (username: string, displayName: string) => void
  onClose: () => void
  position: { top: number; left: number }
  visible: boolean
}

export const MentionAutocomplete = forwardRef<MentionAutocompleteHandle, MentionAutocompleteProps>(
  function MentionAutocomplete({ query, onSelect, onClose, position, visible }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const prevQueryRef = useRef(query)

    if (query !== prevQueryRef.current) {
      prevQueryRef.current = query
      setSelectedIndex(0)
    }

    const { data: users = [], isLoading } = useQuery({
      queryKey: ['mention-search', query],
      queryFn: () => searchApi.users(query),
      enabled: visible && query.length >= 2,
      staleTime: 1000 * 30,
    })

    useImperativeHandle(ref, () => ({
      handleKeyDown: (e: KeyboardEvent): boolean => {
        if (!visible) return false

        if (users.length === 0) {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
            return true
          }
          return false
        }

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setSelectedIndex((i) => (i + 1) % users.length)
            return true
          case 'ArrowUp':
            e.preventDefault()
            setSelectedIndex((i) => (i - 1 + users.length) % users.length)
            return true
          case 'Enter': {
            e.preventDefault()
            const user = users[selectedIndex]
            if (user) onSelect(user.username, user.displayName)
            return true
          }
          case 'Escape':
            e.preventDefault()
            onClose()
            return true
        }
        return false
      },
    }))

    if (!visible) return null

    const showResults = query.length >= 2

    return (
      <div
        className="fixed z-50 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 min-w-[280px] max-h-[300px] overflow-y-auto"
        style={{ top: position.top, left: position.left }}
      >
        {!showResults ? (
          <div className="px-4 py-3 text-gray-400 text-sm">Type 2+ characters...</div>
        ) : isLoading ? (
          <div className="px-4 py-3 text-gray-400 text-sm">Searching...</div>
        ) : users.length === 0 ? (
          <div className="px-4 py-3 text-gray-400 text-sm">No users found</div>
        ) : (
          users.map((user, index) => (
            <UserRow
              key={user.id}
              user={user}
              selected={index === selectedIndex}
              onSelect={() => onSelect(user.username, user.displayName)}
              onHover={() => setSelectedIndex(index)}
            />
          ))
        )}
      </div>
    )
  }
)

interface UserRowProps {
  user: User
  selected: boolean
  onSelect: () => void
  onHover: () => void
}

function UserRow({ user, selected, onSelect, onHover }: UserRowProps) {
  return (
    <button
      type="button"
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        selected ? 'bg-accent-50' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <img
        src={getAvatarUrl(user)}
        alt={user.displayName}
        className="w-8 h-8 rounded-full"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 truncate text-sm">{user.displayName}</div>
        <div className="text-gray-400 text-xs truncate">@{user.username}</div>
      </div>
    </button>
  )
}
