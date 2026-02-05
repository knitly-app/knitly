import { useState } from 'preact/hooks'
import { useNavigate } from '@tanstack/react-router'
import { PostCard } from '../components/PostCard'
import { PostCardSkeleton } from '../components/Skeleton'
import { FeedErrorFallback } from '../components/RouteErrorFallback'
import { CirclePills } from '../components/CirclePills'
import { useAuth } from '../hooks/useAuth'
import { useDeletePost, useEditPost, useFeed, useReaction } from '../hooks/usePosts'
import { useCircles } from '../hooks/useCircles'
import { useAppSettings } from '../hooks/useAppSettings'

export function FeedRoute() {
  const [circleFilter, setCircleFilter] = useState<string | undefined>(undefined)
  const { data: circles } = useCircles()
  const navigate = useNavigate()
  const appName = useAppSettings((s) => s.appName)
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useFeed(circleFilter)
  const reactionMutation = useReaction()
  const deletePost = useDeletePost()
  const editPost = useEditPost()
  const { user } = useAuth()

  const posts = data?.pages.flatMap((page) => page.posts) ?? []

  const circlePillsProps = {
    circles: circles ?? [],
    selectedId: circleFilter ?? null,
    onSelect: (id: string | null) => setCircleFilter(id ?? undefined),
    showAdd: true,
    onAdd: () => void navigate({ to: '/circles' }),
  }

  if (isLoading) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto py-4 md:py-8">
        <div className="space-y-6 px-4 md:px-0">
          <PostCardSkeleton />
          <PostCardSkeleton showMedia />
          <PostCardSkeleton />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto py-4 md:py-8 px-4 md:px-0">
        <FeedErrorFallback onRetry={() => void refetch()} />
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto py-4 md:py-8">
      <div className="md:hidden px-5 mb-6">
        <h1 className="text-2xl font-black text-accent-500 tracking-tighter mb-4">{appName}</h1>
        <CirclePills {...circlePillsProps} />
      </div>

      <div className="hidden md:block px-2 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Network</h2>
        <CirclePills {...circlePillsProps} />
      </div>

      <div className="space-y-6 px-4 md:px-0">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">
              {circleFilter ? 'No posts in this circle yet.' : 'No posts yet. Be the first to share!'}
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onReact={(id, type, currentReaction) => reactionMutation.mutate({ id, type, currentReaction })}
              onDelete={(id) => {
                deletePost.mutate(id)
              }}
              onEdit={(id, content) => {
                editPost.mutate({ id, content })
              }}
            />
          ))
        )}
      </div>

      {hasNextPage && (
        <button
          onClick={() => {
            void fetchNextPage()
          }}
          disabled={isFetchingNextPage}
          className="mx-auto mt-8 px-6 py-3 bg-white rounded-full text-sm font-bold text-gray-600 shadow-sm border border-gray-100 hover:text-accent-500 transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  )
}
