import { PostCard } from '../components/PostCard'
import { Spinner } from '../components/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useDeletePost, useEditPost, useFeed, useReaction } from '../hooks/usePosts'

export function FeedRoute() {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useFeed()
  const reactionMutation = useReaction()
  const deletePost = useDeletePost()
  const editPost = useEditPost()
  const { user } = useAuth()

  const posts = data?.pages.flatMap((page) => page.posts) ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto py-4 md:py-8">
      <div className="md:hidden flex items-center justify-between px-5 mb-6">
        <h1 className="text-2xl font-black text-accent-500 tracking-tighter">Knitly</h1>
      </div>

      <div className="hidden md:flex items-center justify-between px-2 mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Your Network</h2>
      </div>

      <div className="space-y-6 px-4 md:px-0">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No posts yet. Be the first to share!</p>
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
