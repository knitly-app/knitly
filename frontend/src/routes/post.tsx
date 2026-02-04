import { useState } from 'preact/hooks'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { ArrowLeft, Send, Trash2 } from 'lucide-preact'
import { posts as postsApi } from '../api/endpoints'
import { PostCard } from '../components/PostCard'
import { PostCardSkeleton, CommentSkeleton } from '../components/Skeleton'
import { useReaction, useAddComment, usePostComments, useDeletePost, useDeleteComment, useEditPost } from '../hooks/usePosts'
import { useAuth } from '../hooks/useAuth'
import { useConfirm } from '../components/ConfirmModal'
import { useToast } from '../components/Toast'
import { getAvatarUrl } from '../utils/avatar'
import { renderMarkdown } from '../utils/markdown'

export function PostRoute() {
  const params = useParams({ strict: false })
  const postId = typeof params.id === 'string' ? params.id : ''
  const [commentText, setCommentText] = useState('')
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const reactionMutation = useReaction()
  const addCommentMutation = useAddComment()
  const deletePost = useDeletePost({
    onSuccess: () => {
      void navigate({ to: '/' })
    },
  })
  const deleteComment = useDeleteComment()
  const editPost = useEditPost()

  const { data: post, isLoading } = useQuery({
    queryKey: ['posts', postId],
    queryFn: () => postsApi.get(postId),
    enabled: !!postId,
  })

  const { data: comments } = usePostComments(postId)

  const handleSubmitComment = async (e: Event) => {
    e.preventDefault()
    if (!commentText.trim() || !postId) return

    try {
      await addCommentMutation.mutateAsync({ postId, content: commentText })
      setCommentText('')
    } catch {
      toast.error('Failed to add comment')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const ok = await confirm({
      title: 'Delete Comment',
      message: 'This comment will be permanently deleted.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return

    try {
      await deleteComment.mutateAsync({ postId, commentId })
      toast.success('Comment deleted')
    } catch {
      toast.error('Failed to delete comment')
    }
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-4 md:py-8 px-4 md:px-0">
        <div className="mb-6">
          <div className="w-20 h-6 bg-gray-200 animate-pulse rounded" />
        </div>
        <PostCardSkeleton showMedia />
        <div className="mt-8 bg-white rounded-4xl p-6 shadow-sm border border-gray-50">
          <div className="w-24 h-6 bg-gray-200 animate-pulse rounded mb-6" />
          <div className="space-y-4">
            <CommentSkeleton />
            <CommentSkeleton />
            <CommentSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Post not found</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-4 md:py-8 px-4 md:px-0">
      <div className="mb-6">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </button>
      </div>

      <PostCard
      post={post}
      author={post.author}
      currentUserId={currentUser?.id}
      onReact={(id, type, currentReaction) => reactionMutation.mutate({ id, type, currentReaction })}
      onDelete={(id) => {
        deletePost.mutate(id)
      }}
      onEdit={(id, content) => {
        editPost.mutate({ id, content })
      }}
    />

      <div className="mt-8 bg-white rounded-4xl p-6 shadow-sm border border-gray-50">
        <h3 className="font-bold text-gray-900 mb-6">Comments</h3>

        <form
          onSubmit={(e) => {
            void handleSubmitComment(e)
          }}
          className="mb-6"
        >
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={commentText}
              onInput={(e) => setCommentText((e.target as HTMLInputElement).value)}
              placeholder="Add a comment..."
              className="flex-1 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || addCommentMutation.isPending}
              className="p-3 bg-accent-500 text-white rounded-xl hover:bg-accent-600 disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {comments?.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No comments yet. Be the first!</p>
          ) : (
            comments?.map((comment) => (
              <div key={comment.id} className="flex space-x-3">
                <Link to="/profile/$id" params={{ id: comment.userId }}>
                  <img
                    src={getAvatarUrl({ id: comment.userId, avatar: comment.avatar })}
                    alt={comment.displayName}
                    className="w-10 h-10 rounded-full"
                    loading="lazy"
                    decoding="async"
                  />
                </Link>
                <div className="flex-1 bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Link
                      to="/profile/$id"
                      params={{ id: comment.userId }}
                      className="font-bold text-gray-900 text-sm hover:text-accent-500"
                    >
                      {comment.displayName}
                    </Link>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                      {comment.userId === currentUser?.id && (
                        <button
                          onClick={() => {
                            void handleDeleteComment(comment.id)
                          }}
                          className="p-1 rounded-full hover:bg-red-50 transition-colors"
                          aria-label="Delete comment"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p
                    className="text-gray-600 text-sm"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.content) }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
