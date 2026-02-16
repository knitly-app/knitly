import { Link } from '@tanstack/react-router'
import type { User } from '../api/endpoints'
import { getAvatarUrl } from '../utils/avatar'
import { BotBadge } from './BotBadge'

interface ProfileCardProps {
  user: User
}

export function ProfileCard({ user }: ProfileCardProps) {
  return (
    <div className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50">
      <div className="flex items-center space-x-4">
        <Link to="/profile/$id" params={{ id: user.id }}>
          <img
            src={getAvatarUrl(user)}
            alt={user.displayName}
            className="w-14 h-14 rounded-full border-2 border-white shadow-sm"
            loading="lazy"
            decoding="async"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              to="/profile/$id"
              params={{ id: user.id }}
              className="font-bold text-gray-900 hover:text-accent-500 transition-colors truncate"
            >
              {user.displayName}
            </Link>
            {user.role === 'bot' && <BotBadge />}
          </div>
          <p className="text-gray-400 text-sm truncate">@{user.username}</p>
        </div>
      </div>
      {user.bio && (
        <p className="mt-4 text-gray-600 text-sm leading-relaxed">{user.bio}</p>
      )}
    </div>
  )
}
