import { useState, useRef, useEffect } from 'preact/hooks'
import { Link } from '@tanstack/react-router'
import { MessageCircle, Share2, Trash2, Pencil, X, Check, Heart } from 'lucide-preact'
import type { Post, ReactionType, ReactionCounts } from '../api/endpoints'
import { useConfirm } from './ConfirmModal'
import { getAvatarUrl } from '../utils/avatar'
import { useUIStore } from '../stores/ui'
import { useLightbox } from '../stores/lightbox'
import { useToast } from './Toast'
import { formatTimeAgo } from '../utils/time'
import { renderMarkdown } from '../utils/markdown'
import { PollCard } from './PollCard'
import { BotBadge } from './BotBadge'
import { useVotePoll } from '../hooks/usePosts'

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'hugs', emoji: '🤗', label: 'Hugs' },
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
]

interface PostCardProps {
  post: Post
  author?: { displayName: string; username: string; avatar?: string; role?: string }
  currentUserId?: string
  onReact?: (postId: string, type: ReactionType, currentReaction: ReactionType | null) => void
  onDelete?: (postId: string) => void
  onEdit?: (postId: string, content: string) => void
}

function getTotalReactions(reactions: ReactionCounts): number {
  return REACTIONS.reduce((sum, reaction) => sum + (reactions[reaction.type] ?? 0), 0)
}

function ReactionButton({
  reactions,
  userReaction,
  onReact,
}: {
  reactions: ReactionCounts
  userReaction: ReactionType | null
  onReact: (type: ReactionType) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showPicker) return
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker])

  const currentEmoji = userReaction
    ? REACTIONS.find((r) => r.type === userReaction)?.emoji
    : null

  const total = getTotalReactions(reactions)

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`flex items-center space-x-2 p-2 rounded-xl transition-all ${
          userReaction
            ? 'text-accent-500 bg-accent-50'
            : 'text-gray-400 hover:text-accent-500 hover:bg-accent-50'
        }`}
      >
        {total > 0 ? (
          <span className="text-lg">{currentEmoji || '❤️'}</span>
        ) : (
          <Heart size={20} />
        )}
        {total > 0 && <span className="text-sm font-medium">{total}</span>}
      </button>

      {showPicker && (
        <div className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-2 flex space-x-1 z-10">
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              onClick={() => {
                onReact(r.type)
                setShowPicker(false)
              }}
              className={`p-2 rounded-xl hover:bg-gray-100 transition-colors text-xl ${
                userReaction === r.type ? 'bg-accent-50' : ''
              }`}
              title={r.label}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReactionSummary({ reactions }: { reactions: ReactionCounts }) {
  const entries = Object.entries(reactions).filter(([, count]) => count && count > 0)
  if (entries.length === 0) return null

  return (
    <div className="flex items-center space-x-1 text-sm text-gray-500">
      {entries.slice(0, 3).map(([type, count]) => {
        const emoji = REACTIONS.find((r) => r.type === type)?.emoji
        return (
          <span key={type} className="flex items-center">
            <span className="text-sm">{emoji}</span>
            <span className="ml-0.5">{count}</span>
          </span>
        )
      })}
    </div>
  )
}

export function PostCard({ post, author, currentUserId, onReact, onDelete, onEdit }: PostCardProps) {
  const confirm = useConfirm()
  const toast = useToast()
  const { editingPostId, setEditingPost } = useUIStore()
  const [editContent, setEditContent] = useState(post.content || '')
  const votePoll = useVotePoll()
  const isOwner = currentUserId === post.userId
  const canDelete = !!onDelete && isOwner
  const canEdit = !!onEdit && isOwner
  const isEditing = editingPostId === post.id

  const handleShare = async () => {
    const url = `${window.location.origin}/m/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Post',
      message: 'This post will be permanently deleted. This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    })
    if (ok) onDelete?.(post.id)
  }

  const handleEdit = () => {
    setEditContent(post.content || '')
    setEditingPost(post.id)
  }

  const handleSaveEdit = () => {
    if (editContent.trim() || (post.media?.length ?? 0) > 0) {
      onEdit?.(post.id, editContent.trim())
      setEditingPost(null)
    }
  }

  const handleCancelEdit = () => {
    setEditContent(post.content || '')
    setEditingPost(null)
  }

  const postAuthor = author || post.author
  const avatarUrl = getAvatarUrl({ id: post.userId, avatar: postAuthor?.avatar })
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
            alt={postAuthor?.displayName || 'User'}
            className="w-12 h-12 rounded-full border-2 border-white shadow-sm"
            loading="lazy"
            decoding="async"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Link
                to="/profile/$id"
                params={{ id: post.userId }}
                className="font-bold text-gray-900 hover:text-accent-500 transition-colors"
              >
                {postAuthor?.displayName || 'User'}
              </Link>
              {postAuthor?.role === 'bot' && <BotBadge />}
              <span className="text-gray-400 text-sm">@{postAuthor?.username || 'user'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">{formatTimeAgo(post.createdAt, { maxDays: 7 })}</span>
              {canEdit && !isEditing && (
                <button
                  onClick={handleEdit}
                  className="p-1 hover:bg-blue-50 rounded-full transition-colors"
                  aria-label="Edit post"
                >
                  <Pencil size={16} className="text-blue-400" />
                </button>
              )}
              {canDelete && !isEditing && (
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

      {isEditing ? (
        <div className="mb-4">
          <textarea
            value={editContent}
            onInput={(e) => setEditContent((e.target as HTMLTextAreaElement).value)}
            className="w-full px-3 py-2 text-gray-800 text-base leading-relaxed border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-200 focus:border-accent-300 resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end space-x-2 mt-2">
            <button
              onClick={handleCancelEdit}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleSaveEdit}
              className="p-2 rounded-lg text-white bg-accent-500 hover:bg-accent-600 transition-colors"
            >
              <Check size={18} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.content?.trim() && (
            <Link to="/post/$id" params={{ id: post.id }} className="block">
              <p
                className="text-gray-800 text-base leading-relaxed mb-4 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
              />
            </Link>
          )}

          {post.poll && (
            <PollCard
              poll={post.poll}
              onVote={(optionId) => votePoll.mutate({ postId: post.id, optionId })}
              isVoting={votePoll.isPending}
            />
          )}

          {mediaItems.length === 1 && mediaItems[0].type === 'video' && (
            <div className="rounded-3xl overflow-hidden mb-4 -mx-2 bg-black">
              <video
                src={mediaItems[0].url}
                poster={mediaItems[0].thumbnailUrl}
                className="w-full max-h-96"
                controls
                playsInline
                preload="metadata"
              />
            </div>
          )}
          {mediaItems.length === 1 && mediaItems[0].type !== 'video' && (
            <div className="rounded-3xl overflow-hidden mb-4 -mx-2">
              <button
                type="button"
                onClick={() => useLightbox.getState().open(
                  mediaItems.map((m) => ({ url: m.url, alt: "Post media" })),
                  0
                )}
                className="w-full cursor-zoom-in"
              >
                <img
                  src={mediaItems[0].url}
                  alt="Post media"
                  className="w-full h-auto object-cover max-h-96"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </div>
          )}
          {mediaItems.length > 1 && (
            <div className="grid grid-cols-2 gap-2 rounded-3xl overflow-hidden mb-4 -mx-2">
              {mediaItems.map((item, idx) => (
                <button
                  type="button"
                  key={`${item.url}-${idx}`}
                  onClick={() => useLightbox.getState().open(
                    mediaItems.map((m) => ({ url: m.url, alt: "Post media" })),
                    idx
                  )}
                  className="relative w-full aspect-square bg-gray-100 overflow-hidden cursor-zoom-in"
                >
                  <img
                    src={item.url}
                    alt={`Post media ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center space-x-3">
          <ReactionButton
            reactions={post.reactions}
            userReaction={post.userReaction}
            onReact={(type) => onReact?.(post.id, type, post.userReaction)}
          />
          <ReactionSummary reactions={post.reactions} />
        </div>

        <Link
          to="/post/$id"
          params={{ id: post.id }}
          className="flex items-center space-x-2 p-2 rounded-xl text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
        >
          <MessageCircle size={20} />
          <span className="text-sm font-medium">{post.comments}</span>
        </Link>

        <button
          onClick={() => { void handleShare() }}
          className="flex items-center space-x-2 p-2 rounded-xl transition-all text-gray-400 hover:text-green-500 hover:bg-green-50"
        >
          <Share2 size={20} />
        </button>
      </div>
    </div>
  )
}
