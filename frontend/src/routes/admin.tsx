import { useState } from 'preact/hooks'
import { useDeferredValue } from 'preact/compat'
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Users, FileText, Mail, TrendingUp, Copy, Ban, Plus, Search, Trash2 } from 'lucide-preact'
import { admin, invites as invitesApi } from '../api/endpoints'
import { Spinner } from '../components/Spinner'
import { getAvatarUrl } from '../utils/avatar'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { useAuth } from '../hooks/useAuth'
import { formatTimeAgo } from '../utils/time'

export function AdminRoute() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { user: currentUser } = useAuth()
  const search = useSearch({ from: '/admin' })
  const currentTab = search.tab === 'moderation' ? 'moderation' : 'overview'
  const [inviteFilter, setInviteFilter] = useState<'all' | 'active' | 'used' | 'revoked' | 'expired'>('active')
  const [inviteQuery, setInviteQuery] = useState('')
  const [memberFilter, setMemberFilter] = useState<'all' | 'active' | 'disabled' | 'moderators'>('active')
  const [memberQuery, setMemberQuery] = useState('')
  const [moderationQuery, setModerationQuery] = useState('')

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: admin.stats,
    enabled: currentTab === 'overview',
  })

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: admin.users,
    enabled: currentTab === 'overview',
  })

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: invitesApi.list,
    enabled: currentTab === 'overview',
  })

  const deferredModerationQuery = useDeferredValue(moderationQuery)
  const normalizedModerationQuery = deferredModerationQuery.trim()

  const {
    data: moderationPages,
    isLoading: moderationLoading,
    hasNextPage: moderationHasNextPage,
    fetchNextPage: fetchMoreModeration,
    isFetchingNextPage: isFetchingMoreModeration,
  } = useInfiniteQuery({
    queryKey: ['admin', 'content', normalizedModerationQuery],
    queryFn: ({ pageParam }) => admin.content({ cursor: pageParam, q: normalizedModerationQuery }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: currentTab === 'moderation',
  })

  const createInvite = useMutation({
    mutationFn: invitesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      toast.success('Invite created')
    },
    onError: () => {
      toast.error('Failed to create invite')
    },
  })

  const revokeInvite = useMutation({
    mutationFn: (token: string) => invitesApi.revoke(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      toast.success('Invite revoked')
    },
    onError: () => {
      toast.error('Failed to revoke invite')
    },
  })

  const disableUser = useMutation({
    mutationFn: admin.disableUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User disabled')
    },
    onError: () => {
      toast.error('Failed to disable user')
    },
  })

  const enableUser = useMutation({
    mutationFn: admin.enableUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User enabled')
    },
    onError: () => {
      toast.error('Failed to enable user')
    },
  })

  const promoteUser = useMutation({
    mutationFn: admin.promoteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Promoted to moderator')
    },
    onError: () => {
      toast.error('Failed to promote user')
    },
  })

  const demoteUser = useMutation({
    mutationFn: admin.demoteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Demoted to member')
    },
    onError: () => {
      toast.error('Failed to demote user')
    },
  })

  const removeUser = useMutation({
    mutationFn: admin.removeUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User removed')
    },
    onError: () => {
      toast.error('Failed to remove user')
    },
  })

  const deleteContent = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'post' | 'comment' }) =>
      admin.deleteContent(id, type),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'content'] })
      void queryClient.invalidateQueries({ queryKey: ['feed'] })
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
      if (variables.type === 'comment' && data.postId) {
        void queryClient.invalidateQueries({ queryKey: ['posts', data.postId, 'comments'] })
      }
      toast.success('Content removed')
    },
    onError: () => {
      toast.error('Failed to remove content')
    },
  })

  const handleCopyInvite = (token: string) => {
    void (async () => {
      const url = `${window.location.origin}/invite/${token}`
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Invite link copied')
      } catch {
        toast.error('Failed to copy invite link')
      }
    })()
  }

  const handleDisableUser = (userId: string) => {
    void (async () => {
      const ok = await confirm({
        title: 'Disable User',
        message: 'They will be logged out and cannot log back in.',
        confirmText: 'Disable',
        danger: true,
      })
      if (ok) disableUser.mutate(userId)
    })()
  }

  const handleRemoveUser = (userId: string) => {
    void (async () => {
      const ok = await confirm({
        title: 'Remove User',
        message: 'This removes the user and their content.',
        confirmText: 'Remove',
        danger: true,
      })
      if (ok) removeUser.mutate(userId)
    })()
  }

  const handleDeleteContent = (id: string, type: 'post' | 'comment') => {
    void (async () => {
      const ok = await confirm({
        title: type === 'post' ? 'Remove Post' : 'Remove Comment',
        message: 'This content will no longer be visible.',
        confirmText: 'Remove',
        danger: true,
      })
      if (ok) deleteContent.mutate({ id, type })
    })()
  }

  const moderationItems = moderationPages?.pages.flatMap((page) => page.items) ?? []

  const statCards = [
    { icon: Users, label: 'Total Users', value: stats?.users ?? 0, color: 'bg-blue-500' },
    { icon: FileText, label: 'Total Posts', value: stats?.posts ?? 0, color: 'bg-green-500' },
    { icon: Mail, label: 'Active Invites', value: stats?.invites ?? 0, color: 'bg-purple-500' },
  ]

  const inviteItems = invites ?? []
  const normalizedInviteQuery = inviteQuery.trim().toLowerCase()
  const inviteCounts = {
    all: 0,
    active: 0,
    used: 0,
    revoked: 0,
    expired: 0,
  }

  const getInviteStatus = (invite: (typeof inviteItems)[number]) => {
    if (invite.used) return 'used'
    if (invite.revokedAt) return 'revoked'
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) return 'expired'
    return 'active'
  }

  inviteItems.forEach((invite) => {
    const status = getInviteStatus(invite)
    inviteCounts.all += 1
    inviteCounts[status] += 1
  })

  const filteredInvites = inviteItems.filter((invite) => {
    const status = getInviteStatus(invite)
    if (inviteFilter !== 'all' && inviteFilter !== status) return false
    if (!normalizedInviteQuery) return true
    const tokenMatch = invite.token.toLowerCase().includes(normalizedInviteQuery)
    const usedByMatch = invite.usedBy?.username?.toLowerCase().includes(normalizedInviteQuery)
    const invitedByMatch = invite.invitedBy?.username?.toLowerCase().includes(normalizedInviteQuery)
    return tokenMatch || usedByMatch || invitedByMatch
  })

  const memberItems = users ?? []
  const normalizedMemberQuery = memberQuery.trim().toLowerCase()
  const memberCounts = {
    all: 0,
    active: 0,
    disabled: 0,
    moderators: 0,
  }

  memberItems.forEach((member) => {
    memberCounts.all += 1
    if (member.disabledAt) {
      memberCounts.disabled += 1
    } else {
      memberCounts.active += 1
    }
    if (member.role === 'moderator') {
      memberCounts.moderators += 1
    }
  })

  const filteredMembers = memberItems.filter((member) => {
    if (memberFilter === 'disabled' && !member.disabledAt) return false
    if (memberFilter === 'active' && member.disabledAt) return false
    if (memberFilter === 'moderators' && member.role !== 'moderator') return false
    if (!normalizedMemberQuery) return true
    const name = member.displayName?.toLowerCase() ?? ''
    const username = member.username?.toLowerCase() ?? ''
    return name.includes(normalizedMemberQuery) || username.includes(normalizedMemberQuery)
  })

  return (
    <div className="w-full max-w-4xl mx-auto py-4 md:py-8 px-4 md:px-0">
      <div className="mb-8 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="w-16" />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'moderation', label: 'Moderation' },
        ].map((tab) => (
          <Link
            key={tab.id}
            to="/admin"
            search={{ tab: tab.id === 'overview' ? undefined : tab.id }}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              currentTab === tab.id
                ? 'bg-accent-500 text-white'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {currentTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center`}>
                    <stat.icon size={24} className="text-white" />
                  </div>
                  <TrendingUp size={20} className="text-green-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {statsLoading ? '-' : stat.value.toLocaleString()}
                </p>
                <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-4xl shadow-sm border border-gray-50 overflow-hidden mb-10">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Invites</h2>
          <button
            onClick={() => createInvite.mutate()}
            disabled={createInvite.isPending}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-accent-500 text-white rounded-full text-sm font-bold shadow-sm hover:bg-accent-600 transition-colors disabled:opacity-60"
          >
            <Plus size={16} />
            <span>{createInvite.isPending ? 'Creating...' : 'New Invite'}</span>
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={inviteQuery}
              onInput={(e) => setInviteQuery((e.target as HTMLInputElement).value)}
              placeholder="Search by token or user..."
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-10 py-3 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'active', label: 'Active', count: inviteCounts.active },
              { id: 'used', label: 'Used', count: inviteCounts.used },
              { id: 'revoked', label: 'Revoked', count: inviteCounts.revoked },
              { id: 'expired', label: 'Expired', count: inviteCounts.expired },
              { id: 'all', label: 'All', count: inviteCounts.all },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() =>
                  setInviteFilter(filter.id as 'all' | 'active' | 'used' | 'revoked' | 'expired')
                }
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  inviteFilter === filter.id
                    ? 'bg-accent-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </div>

        {invitesLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="sm" />
          </div>
        ) : inviteItems.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No invites yet</div>
        ) : filteredInvites.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No invites found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredInvites.map((invite) => {
              const status = getInviteStatus(invite)
              const isActive = status === 'active'
              const statusLabel =
                status === 'used'
                  ? 'Used'
                  : status === 'revoked'
                    ? 'Revoked'
                    : status === 'expired'
                      ? 'Expired'
                      : 'Active'
              const statusClasses =
                status === 'used'
                  ? 'bg-gray-100 text-gray-600'
                  : status === 'revoked'
                    ? 'bg-red-50 text-red-600'
                    : status === 'expired'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-green-50 text-green-700'

              const metaParts = [
                `Created ${new Date(invite.createdAt).toLocaleDateString()}`,
                invite.invitedBy?.username ? `by @${invite.invitedBy.username}` : null,
                invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleDateString()}` : null,
                invite.revokedAt ? `Revoked ${new Date(invite.revokedAt).toLocaleDateString()}` : null,
                invite.usedBy?.username ? `Used by @${invite.usedBy.username}` : null,
              ].filter(Boolean)

              return (
                <div key={invite.token} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${statusClasses}`}>
                        {statusLabel}
                      </span>
                      <span className="text-sm text-gray-400 truncate">{invite.token}</span>
                    </div>
                    <div className="text-xs text-gray-400">{metaParts.join(' · ')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyInvite(invite.token)}
                      disabled={!isActive}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      <Copy size={16} />
                      Copy Link
                    </button>
                    <button
                      onClick={() => revokeInvite.mutate(invite.token)}
                      disabled={!isActive || revokeInvite.isPending}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <Ban size={16} />
                      Revoke
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-4xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Members</h2>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={memberQuery}
              onInput={(e) => setMemberQuery((e.target as HTMLInputElement).value)}
              placeholder="Search members..."
              className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-10 py-3 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'active', label: 'Active', count: memberCounts.active },
              { id: 'disabled', label: 'Disabled', count: memberCounts.disabled },
              { id: 'moderators', label: 'Moderators', count: memberCounts.moderators },
              { id: 'all', label: 'All', count: memberCounts.all },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() =>
                  setMemberFilter(filter.id as 'all' | 'active' | 'disabled' | 'moderators')
                }
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  memberFilter === filter.id
                    ? 'bg-accent-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="sm" />
          </div>
        ) : memberItems.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No members yet</div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No members found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredMembers.map((member) => {
              const isOwner = member.role === 'admin'
              const isModerator = member.role === 'moderator'
              const isDisabled = !!member.disabledAt
              const isSelf = member.id === currentUser?.id
              const roleLabel = isOwner ? 'Owner' : isModerator ? 'Moderator' : 'Member'
              const roleClass = isOwner
                ? 'bg-gray-900 text-white'
                : isModerator
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-600'

              return (
                <div key={member.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <Link
                    to="/profile/$id"
                    params={{ id: member.id }}
                    className="flex items-center gap-4 min-w-0"
                  >
                    <img
                      src={getAvatarUrl(member)}
                      alt={member.displayName}
                      className="w-11 h-11 rounded-full"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{member.displayName}</p>
                        {isSelf && (
                          <span className="text-xs text-gray-400">(you)</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">@{member.username}</p>
                    </div>
                  </Link>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${roleClass}`}>
                      {roleLabel}
                    </span>
                    {isDisabled && (
                      <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-red-50 text-red-600">
                        Disabled
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isOwner && (
                      <>
                        {isDisabled ? (
                          <button
                            onClick={() => enableUser.mutate(member.id)}
                            disabled={enableUser.isPending}
                            className="px-3 py-2 rounded-full text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            Enable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDisableUser(member.id)}
                            disabled={disableUser.isPending}
                            className="px-3 py-2 rounded-full text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            Disable
                          </button>
                        )}

                        {isModerator ? (
                          <button
                            onClick={() => demoteUser.mutate(member.id)}
                            disabled={demoteUser.isPending}
                            className="px-3 py-2 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            Demote
                          </button>
                        ) : (
                          <button
                            onClick={() => promoteUser.mutate(member.id)}
                            disabled={promoteUser.isPending}
                            className="px-3 py-2 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            Promote
                          </button>
                        )}

                        <button
                          onClick={() => handleRemoveUser(member.id)}
                          disabled={removeUser.isPending}
                          className="px-3 py-2 rounded-full text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
          </div>

          <div className="mt-10 rounded-4xl border border-red-100 bg-red-50/60 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-red-700 mb-2">Danger Zone</h2>
            <p className="text-sm text-red-600 mb-4">
              High-risk actions live here. These will be gated with extra confirmation.
            </p>
            <div className="space-y-2 text-sm text-red-600">
              <div>• Transfer ownership</div>
              <div>• Export archive</div>
              <div>• Delete network</div>
            </div>
            <div className="mt-4">
              <button
                disabled
                className="px-4 py-2 rounded-full text-sm font-semibold bg-red-100 text-red-400 cursor-not-allowed"
              >
                Coming soon
              </button>
            </div>
          </div>
        </>
      )}

      {currentTab === 'moderation' && (
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
                className="w-full rounded-2xl border border-gray-100 bg-gray-50 px-10 py-3 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all"
              />
            </div>
          </div>

          {moderationLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner size="sm" />
            </div>
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
      )}
    </div>
  )
}
