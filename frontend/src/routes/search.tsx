import { useState, useMemo } from 'preact/hooks'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search as SearchIcon, PlusCircle, Share2 } from 'lucide-preact'
import { search as searchApi, invites } from '../api/endpoints'
import { ProfileCard } from '../components/ProfileCard'
import { PostCard } from '../components/PostCard'
import { Spinner } from '../components/Spinner'
import { useLikePost } from '../hooks/usePosts'

export function SearchRoute() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'people' | 'posts'>('people')
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()
  const likeMutation = useLikePost()

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

  const { data: myInvites } = useQuery({
    queryKey: ['invites'],
    queryFn: invites.list,
  })

  const createInvite = useMutation({
    mutationFn: invites.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invites'] })
    },
  })

  const availableInvites = myInvites?.filter((i) => !i.used).length ?? 0
  const latestInvite = useMemo(() => myInvites?.find((i) => !i.used) ?? myInvites?.[0], [myInvites])
  const inviteToken = latestInvite?.token
  const inviteLink = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : ''

  const handleCopyInvite = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

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
                <ProfileCard key={user.id} user={user} showFollow />
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
                  onLike={(id, liked) => likeMutation.mutate({ id, liked })}
                />
              ))
            )}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-5xl p-8 shadow-sm border border-gray-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-lg">Your Invites</h3>
                <div className="flex items-center space-x-2">
                  <span className="bg-green-100 text-green-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                    {availableInvites} Free
                  </span>
                  <button
                    onClick={() => createInvite.mutate()}
                    disabled={createInvite.isPending}
                    className="text-xs font-bold text-accent-500 hover:text-accent-600 disabled:opacity-50"
                  >
                    {createInvite.isPending ? '...' : 'New'}
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                Knitly is an invite-only space limited to 100 members per cluster.
              </p>
            </div>
            <button
              onClick={() => {
                void handleCopyInvite()
              }}
              className="flex items-center bg-gray-50 rounded-2xl p-4 border border-gray-100 group cursor-pointer hover:border-accent-200 transition-colors text-left"
            >
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">
                  {copied ? 'Copied' : 'Invite Link'}
                </p>
                <p className="text-lg font-mono font-bold text-gray-700 tracking-[0.2em]">
                  {inviteToken?.slice(0, 12) ?? 'KNITLY-XXXX'}
                </p>
              </div>
              <Share2 className="text-gray-400 group-hover:text-accent-500 transition-colors" size={22} />
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 mb-2 px-1 text-lg">Suggested</h3>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-50 hover:border-accent-100 transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 bg-accent-50 rounded-xl flex items-center justify-center mr-4 text-accent-500">
                  <PlusCircle size={24} />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Invite Friend {i}</p>
                  <p className="text-xs text-gray-400 font-medium">Share your invite link</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
