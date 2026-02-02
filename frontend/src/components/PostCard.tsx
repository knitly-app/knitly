import { Link } from '@tanstack/react-router'
import { Heart, MessageCircle, Share2, Trash2 } from 'lucide-preact'
import type { Post } from '../api/endpoints'
import { useConfirm } from './ConfirmModal'
import { getAvatarUrl } from '../utils/avatar'

interface PostCardProps {
  post: Post
  author?: { displayName: string; username: string; avatar?: string }
  currentUserId?: string
  onLike?: (postId: string, liked: boolean) => void
  onDelete?: (postId: string) => void
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString()
}

export function PostCard({ post, author, currentUserId, onLike, onDelete }: PostCardProps) {
  const confirm = useConfirm()
  const canDelete = !!onDelete && currentUserId === post.userId

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Post',
      message: 'This post will be permanently deleted. This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    })
    if (ok) onDelete?.(post.id)
  }

  const avatarUrl = getAvatarUrl({ id: post.userId, avatar: author?.avatar })
  const mediaItems = post.media?.length
    ? post.media
    : post.mediaUrl
      ? [{ url: post.mediaUrl, type: 'image' as const }]
      : []

  return (
    <div className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-4 mb-4">
        <Link to="/profile/$id" params={{ id: post.userId }}>
          <img
            src={avatarUrl}
            alt={author?.displayName || 'User'}
            className="w-12 h-12 rounded-full border-2 border-white shadow-sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to="/profile/$id"
                params={{ id: post.userId }}
                className="font-bold text-gray-900 hover:text-accent-500 transition-colors"
              >
                {author?.displayName || 'User'}
              </Link>
              <span className="text-gray-400 text-sm ml-2">@{author?.username || 'user'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">{formatTimeAgo(post.createdAt)}</span>
              {canDelete && (
                <button
                  onClick={() => {
                    void handleDelete()
                  }}
                  className="p-1 hover:bg-red-50 rounded-full transition-colors"
                  aria-label="Delete post"
                >
                  <Trash2 size={16} className="text-red-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Link to="/post/$id" params={{ id: post.id }} className="block">
        {post.content?.trim() && (
          <p className="text-gray-800 text-base leading-relaxed mb-4 whitespace-pre-wrap">
            {post.content}
          </p>
        )}

        {mediaItems.length === 1 && (
          <div className="rounded-3xl overflow-hidden mb-4 -mx-2">
            <img
              src={mediaItems[0].url}
              alt="Post media"
              className="w-full h-auto object-cover max-h-96"
            />
          </div>
        )}
        {mediaItems.length > 1 && (
          <div className="grid grid-cols-2 gap-2 rounded-3xl overflow-hidden mb-4 -mx-2">
            {mediaItems.map((item, idx) => (
              <div
                key={`${item.url}-${idx}`}
                className="relative w-full aspect-square bg-gray-100 overflow-hidden"
              >
                <img
                  src={item.url}
                  alt={`Post media ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </Link>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <button
          onClick={() => onLike?.(post.id, post.liked)}
          className={`flex items-center space-x-2 p-2 rounded-xl transition-all ${
            post.liked
              ? 'text-accent-500 bg-accent-50'
              : 'text-gray-400 hover:text-accent-500 hover:bg-accent-50'
          }`}
        >
          <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
          <span className="text-sm font-medium">{post.likes}</span>
        </button>

        <Link
          to="/post/$id"
          params={{ id: post.id }}
          className="flex items-center space-x-2 p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
        >
          <MessageCircle size={20} />
          <span className="text-sm font-medium">{post.comments}</span>
        </Link>

        <button className="flex items-center space-x-2 p-2 rounded-xl text-gray-400 hover:text-green-500 hover:bg-green-50 transition-all">
          <Share2 size={20} />
        </button>
      </div>
    </div>
  )
}
