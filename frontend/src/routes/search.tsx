import { useState } from 'preact/hooks'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-preact'
import { search as searchApi } from '../api/endpoints'
import { ProfileCard } from '../components/ProfileCard'
import { PostCard } from '../components/PostCard'
import { Spinner } from '../components/Spinner'
import { useReaction } from '../hooks/usePosts'
import { useUIStore } from '../stores/ui'

export function SearchRoute() {
  const [query, setQuery] = useState('')
  const { searchMode: mode, setSearchMode: setMode } = useUIStore()
  const reactionMutation = useReaction()

  const { data: users, isLoading } = useQuery({
    queryKey: ['search', 'users', query],
    queryFn: () => searchApi.users(query),
    enabled: query.length >= 2 && mode === 'people',
  })

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['search', 'posts', query],
    queryFn: () => searchApi.posts(query),
    enabled: query.length >= 2 && mode === 'posts',
  })

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-5">
      <div className="relative mb-10 group">
        <SearchIcon
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-accent-400 transition-colors"
          size={20}
        />
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Search friends & family..."
          className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-base focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all shadow-sm"
        />
      </div>

      <div className="flex items-center space-x-3 mb-8">
        <button
          onClick={() => setMode('people')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
            mode === 'people' ? 'bg-accent-500 text-white' : 'bg-white text-gray-500 border border-gray-100'
          }`}
        >
          People
        </button>
        <button
          onClick={() => setMode('posts')}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
            mode === 'posts' ? 'bg-accent-500 text-white' : 'bg-white text-gray-500 border border-gray-100'
          }`}
        >
          Posts
        </button>
      </div>

      {query.length >= 2 ? (
        mode === 'people' ? (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="sm" />
              </div>
            ) : users?.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400">No users found for "{query}"</p>
              </div>
            ) : (
              users?.map((user) => (
                <ProfileCard key={user.id} user={user} />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {postsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="sm" />
              </div>
            ) : posts?.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-400">No posts found for "{query}"</p>
              </div>
            ) : (
              posts?.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReact={(id, type, currentReaction) => reactionMutation.mutate({ id, type, currentReaction })}
                />
              ))
            )}
          </div>
        )
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">Search for people or moments</p>
        </div>
      )}
    </div>
  )
}
