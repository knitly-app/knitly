import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from '@tanstack/react-router'
import { MapPin, Calendar, Link as LinkIcon, Settings } from 'lucide-preact'
import { users, posts as postsApi } from '../api/endpoints'
import { useAuth } from '../hooks/useAuth'
import { useFollow } from '../hooks/useFollow'
import { PostCard } from '../components/PostCard'
import { Spinner } from '../components/Spinner'
import { useLikePost, useDeletePost } from '../hooks/usePosts'
import { useToast } from '../components/Toast'
import { getAvatarUrl } from '../utils/avatar'

export function ProfileRoute() {
  const params = useParams({ from: '/profile/$id' })
  const { user: currentUser } = useAuth()
  const likeMutation = useLikePost()
  const deletePost = useDeletePost()
  const toast = useToast()

  const handleDelete = async (id: string) => {
    try {
      await deletePost.mutateAsync(id)
      toast.success('Post deleted')
    } catch {
      toast.error('Failed to delete post')
    }
  }

  const userId = params.id === 'me' ? currentUser?.id : params.id
  const isOwnProfile = params.id === 'me' || params.id === currentUser?.id

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => users.get(userId!),
    enabled: !!userId,
  })

  const { toggle: toggleFollow, isPending: followPending } = useFollow(userId)

  const handleFollowClick = () => toggleFollow(!!user?.isFollowing)

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
        <div className="h-32 bg-gradient-to-r from-accent-400 to-accent-600" />

        <div className="px-8 pb-8">
          <div className="flex items-end justify-between -mt-12 mb-6">
            <img
              src={getAvatarUrl(user)}
              alt={user.displayName}
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
            />
            {isOwnProfile ? (
              <Link
                to="/settings"
                className="px-6 py-2 bg-white rounded-full text-sm font-bold text-gray-600 shadow-sm border border-gray-200 hover:border-gray-300 transition-colors flex items-center space-x-2"
              >
                <Settings size={16} />
                <span>Edit Profile</span>
              </Link>
            ) : (
              <button
                onClick={handleFollowClick}
                disabled={followPending}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-colors disabled:opacity-50 ${
                  user?.isFollowing
                    ? 'bg-white text-gray-600 border border-gray-200 hover:border-red-300 hover:text-red-500'
                    : 'bg-accent-500 text-white shadow-lg shadow-accent-200 hover:bg-accent-600'
                }`}
              >
                {user?.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{user.displayName}</h1>
            <p className="text-gray-400">@{user.username}</p>
          </div>

          {user.bio && (
            <p className="text-gray-600 mb-4 leading-relaxed">{user.bio}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <div className="flex items-center space-x-1">
              <MapPin size={14} />
              <span>Somewhere</span>
            </div>
            <div className="flex items-center space-x-1">
              <LinkIcon size={14} />
              <a href="#" className="text-accent-500 hover:underline">example.com</a>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar size={14} />
              <span>Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="flex gap-6 mt-6 pt-6 border-t border-gray-100">
            <div>
              <span className="font-bold text-gray-900">{posts?.length ?? 0}</span>
              <span className="text-gray-400 ml-1">posts</span>
            </div>
            <div className="cursor-pointer hover:underline">
              <span className="font-bold text-gray-900">{user?.following ?? 0}</span>
              <span className="text-gray-400 ml-1">following</span>
            </div>
            <div className="cursor-pointer hover:underline">
              <span className="font-bold text-gray-900">{user?.followers ?? 0}</span>
              <span className="text-gray-400 ml-1">followers</span>
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
              onLike={(id, liked) => likeMutation.mutate({ id, liked })}
              onDelete={(id) => {
                void handleDelete(id)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
