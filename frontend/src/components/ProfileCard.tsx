import { Link } from '@tanstack/react-router'
import type { User } from '../api/endpoints'
import { getAvatarUrl } from '../utils/avatar'

interface ProfileCardProps {
  user: User
  showFollow?: boolean
  isFollowing?: boolean
  onFollow?: () => void
}

export function ProfileCard({ user, showFollow = false, isFollowing = false, onFollow }: ProfileCardProps) {
  return (
    <div className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50">
      <div className="flex items-center space-x-4">
        <Link to="/profile/$id" params={{ id: user.id }}>
          <img
            src={getAvatarUrl(user)}
            alt={user.displayName}
            className="w-14 h-14 rounded-full border-2 border-white shadow-sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to="/profile/$id"
            params={{ id: user.id }}
            className="font-bold text-gray-900 hover:text-accent-500 transition-colors block truncate"
          >
            {user.displayName}
          </Link>
          <p className="text-gray-400 text-sm truncate">@{user.username}</p>
        </div>
        {showFollow && (
          <button
            onClick={onFollow}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              isFollowing
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-accent-500 text-white hover:bg-accent-600 shadow-lg shadow-accent-200'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
      {user.bio && (
        <p className="mt-4 text-gray-600 text-sm leading-relaxed">{user.bio}</p>
      )}
    </div>
  )
}
