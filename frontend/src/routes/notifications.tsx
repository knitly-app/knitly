import { Link } from '@tanstack/react-router'
import { useNotifications, useMarkNotificationRead, useClearAllNotifications } from '../hooks/useNotifications'
import { NotificationSkeleton } from '../components/Skeleton'
import { getAvatarUrl } from '../utils/avatar'
import { formatTimeAgo } from '../utils/time'

function getNotificationText(type: string): string {
  switch (type) {
    case 'reaction':
    case 'like':
      return 'reacted to your moment'
    case 'comment':
      return 'commented on your post'
    case 'invite':
      return 'joined via your invite'
    case 'mention':
      return 'mentioned you in a post'
    default:
      return 'interacted with you'
  }
}

export function NotificationsRoute() {
  const { data: notifications, isLoading } = useNotifications()
  const markReadMutation = useMarkNotificationRead()
  const clearAllMutation = useClearAllNotifications()

  const handleNotificationClick = (id: string, read: boolean) => {
    if (!read) {
      markReadMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 px-5">
        <h2 className="text-2xl font-bold mb-8 text-gray-900">Activity</h2>
        <div className="space-y-4">
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-5">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Activity</h2>
        {(notifications?.length ?? 0) > 0 && (
          <button
            onClick={() => clearAllMutation.mutate()}
            disabled={clearAllMutation.isPending}
            className="text-sm font-semibold text-gray-600 hover:text-red-600 bg-gray-100 hover:bg-red-50 px-4 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            {clearAllMutation.isPending ? 'Clearing…' : 'Clear all'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications?.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400">No notifications yet</p>
          </div>
        ) : (
          notifications?.map((notif) => (
            <Link
              key={notif.id}
              to={notif.postId ? '/post/$id' : '/profile/$id'}
              params={{ id: notif.postId ?? notif.fromUserId }}
              onClick={() => handleNotificationClick(notif.id, notif.read)}
              className={`flex items-center p-4 rounded-3xl transition-all hover:translate-x-1 cursor-pointer ${
                notif.read
                  ? 'bg-white'
                  : 'bg-accent-50 border border-accent-100 shadow-sm'
              }`}
            >
              <img
                src={getAvatarUrl({ id: notif.fromUserId, avatar: notif.fromAvatar })}
                className="w-14 h-14 rounded-full mr-5 border-2 border-white shadow-sm"
                alt={notif.fromDisplayName}
                loading="lazy"
                decoding="async"
              />
              <div className="flex-1">
                <p className="text-sm text-gray-800 leading-snug">
                  <span className="font-bold">{notif.fromDisplayName || notif.fromUsername}</span> {getNotificationText(notif.type)}.
                </p>
                <p className="text-xs text-gray-400 mt-1.5">{formatTimeAgo(notif.createdAt, { includeAgo: true })}</p>
              </div>
              {!notif.read && (
                <div className="w-2.5 h-2.5 bg-accent-500 rounded-full ml-4 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
