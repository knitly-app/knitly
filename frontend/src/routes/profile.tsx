import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { MapPin, Link as LinkIcon, Settings } from 'lucide-preact'
import { users, posts as postsApi } from '../api/endpoints'
import { useAuth } from '../hooks/useAuth'
import { PostCard } from '../components/PostCard'
import { Spinner } from '../components/Spinner'
import { useReaction, useDeletePost, useEditPost } from '../hooks/usePosts'
import { getAvatarUrl } from '../utils/avatar'

export function ProfileRoute() {
  const params = useParams({ from: '/profile/$id' })
  const { user: currentUser } = useAuth()
  const reactionMutation = useReaction()
  const deletePost = useDeletePost()
  const editPost = useEditPost()

  const userId = params.id === 'me' ? currentUser?.id : params.id
  const isOwnProfile = params.id === 'me' || params.id === currentUser?.id

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => users.get(userId!),
    enabled: !!userId,
  })

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['users', userId, 'posts'],
    queryFn: () => postsApi.userPosts(userId!),
    enabled: !!userId,
  })

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">User not found</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-4 md:py-8 px-4 md:px-0">
      <div className="bg-white rounded-5xl overflow-hidden shadow-sm border border-gray-50 mb-8">
        {user.header ? (
          <div className="h-32 overflow-hidden">
            <img src={user.header} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-r from-accent-400 to-accent-600" />
        )}

        <div className="px-8 pb-8">
          <div className="flex items-end justify-between -mt-12 mb-6">
            <img
              src={getAvatarUrl(user)}
              alt={user.displayName}
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
            />
            {isOwnProfile && (
              <Link
                to="/settings"
                className="px-6 py-2 bg-white rounded-full text-sm font-bold text-gray-600 shadow-sm border border-gray-200 hover:border-gray-300 transition-colors flex items-center space-x-2"
              >
                <Settings size={16} />
                <span>Edit Profile</span>
              </Link>
            )}
          </div>

          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{user.displayName}</h1>
            <p className="text-gray-400">@{user.username}</p>
          </div>

          {user.bio && (
            <p className="text-gray-600 mb-4 leading-relaxed">{user.bio}</p>
          )}

          {(user.location || user.website) && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
              {user.location && (
                <div className="flex items-center space-x-1">
                  <MapPin size={14} />
                  <span>{user.location}</span>
                </div>
              )}
              {user.website && (
                <div className="flex items-center space-x-1">
                  <LinkIcon size={14} />
                  <a href={user.website.startsWith('http') ? user.website : `https://${user.website}`} target="_blank" rel="noopener noreferrer" className="text-accent-500 hover:underline">
                    {user.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-6 mt-6 pt-6 border-t border-gray-100">
            <div>
              <span className="font-bold text-gray-900">{posts?.length ?? 0}</span>
              <span className="text-gray-400 ml-1">moments</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {postsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="sm" />
          </div>
        ) : posts?.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400">No posts yet</p>
          </div>
        ) : (
          posts?.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={user}
              currentUserId={currentUser?.id}
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
    </div>
  )
}
