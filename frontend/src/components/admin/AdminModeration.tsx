import { useState } from 'preact/hooks'
import { useDeferredValue } from 'preact/compat'
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Search, Trash2 } from 'lucide-preact'
import { admin } from '../../api/endpoints'
import { AdminTableSkeleton } from '../Skeleton'
import { getAvatarUrl } from '../../utils/avatar'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmModal'
import { formatTimeAgo } from '../../utils/time'
import { queryKeys } from '../../api/queryKeys'
import { confirmThenMutate } from './confirmThenMutate'

export function AdminModeration() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [moderationQuery, setModerationQuery] = useState('')
  const deferredModerationQuery = useDeferredValue(moderationQuery)
  const normalizedModerationQuery = deferredModerationQuery.trim()

  const {
    data: moderationPages,
    isLoading: moderationLoading,
    hasNextPage: moderationHasNextPage,
    fetchNextPage: fetchMoreModeration,
    isFetchingNextPage: isFetchingMoreModeration,
  } = useInfiniteQuery({
    queryKey: queryKeys.admin.content(normalizedModerationQuery),
    queryFn: ({ pageParam }) => admin.content({ cursor: pageParam, q: normalizedModerationQuery }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const deleteContent = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'post' | 'comment' }) =>
      admin.deleteContent(id, type),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.content() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all() })
      if (variables.type === 'comment' && data.postId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.posts.comments(data.postId) })
      }
      toast.success('Content removed')
    },
    onError: () => {
      toast.error('Failed to remove content')
    },
  })

  const handleDeleteContent = (id: string, type: 'post' | 'comment') =>
    confirmThenMutate(
      confirm,
      {
        title: type === 'post' ? 'Remove Post' : 'Remove Comment',
        message: 'This content will no longer be visible.',
        confirmText: 'Remove',
        danger: true,
      },
      () => deleteContent.mutate({ id, type })
    )

  const moderationItems = moderationPages?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="bg-white rounded-4xl shadow-sm border border-gray-50 overflow-hidden mb-10">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Moderation</h2>
        <span className="text-xs text-gray-400">Recent posts & comments</span>
      </div>

      <div className="px-6 py-4 border-b border-gray-100">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={moderationQuery}
            onInput={(e) => setModerationQuery((e.target as HTMLInputElement).value)}
            placeholder="Search members or words..."
            aria-label="Search content for moderation"
            className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-10 py-3 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all"
          />
        </div>
      </div>

      {moderationLoading ? (
        <AdminTableSkeleton count={5} />
      ) : moderationItems.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">
          {normalizedModerationQuery ? 'No matches found' : 'Nothing to review'}
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {moderationItems.map((item) => {
              const isPost = item.type === 'post'
              const badgeClass = isPost ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
              const badgeLabel = isPost ? 'Post' : 'Comment'
              return (
                <div key={`${item.type}-${item.id}`} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getAvatarUrl({ id: item.author.id, avatar: item.author.avatar })}
                        alt={item.author.displayName}
                        className="w-9 h-9 rounded-full"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 truncate">
                            {item.author.displayName}
                          </span>
                          <span className="text-xs text-gray-400 truncate">@{item.author.username}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatTimeAgo(item.createdAt, { includeAgo: true })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                      <button
                        onClick={() => handleDeleteContent(item.id, item.type)}
                        disabled={deleteContent.isPending}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {item.content}
                  </div>
                  {item.type === 'post' ? (
                    <div className="text-xs text-gray-400">
                      {item.mediaCount ? `${item.mediaCount} media` : 'No media'} ·{' '}
                      {item.commentsCount ?? 0} comments
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">
                      On post by {item.postAuthor?.displayName ?? 'Unknown'} ·{' '}
                      {item.postId ? (
                        <Link
                          to="/post/$id"
                          params={{ id: item.postId }}
                          className="text-accent-500 hover:underline"
                        >
                          View post
                        </Link>
                      ) : (
                        <span>Post unavailable</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {moderationHasNextPage && (
            <div className="p-4 flex justify-center">
              <button
                onClick={() => {
                  void fetchMoreModeration()
                }}
                disabled={isFetchingMoreModeration}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isFetchingMoreModeration ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
