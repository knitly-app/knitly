import { useMemo, useState } from 'preact/hooks'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-preact'
import { users } from '../api/endpoints'
import { ProfileCard } from '../components/ProfileCard'
import { Spinner } from '../components/Spinner'

export function MembersRoute() {
  const [query, setQuery] = useState('')
  const { data: members, isLoading, error } = useQuery({
    queryKey: ['members'],
    queryFn: users.list,
  })

  const filtered = useMemo(() => {
    if (!members) return []
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((member) => {
      return (
        member.displayName.toLowerCase().includes(q) ||
        member.username.toLowerCase().includes(q)
      )
    })
  }, [members, query])

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-5">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Members</h2>
        <span className="text-sm text-gray-400">{members?.length ?? 0} total</span>
      </div>

      <div className="relative mb-8 group">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-accent-400 transition-colors"
          size={20}
        />
        <input
          type="text"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Search members..."
          className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-base focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner size="sm" />
        </div>
      ) : error ? (
        <div className="text-center py-10">
          <p className="text-gray-400">Failed to load members</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-400">No members found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((member) => (
            <ProfileCard key={member.id} user={member} />
          ))}
        </div>
      )}
    </div>
  )
}
