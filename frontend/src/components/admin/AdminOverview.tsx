import { useState } from 'preact/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Users, FileText, Mail, TrendingUp, Copy, Ban, Plus, Search, ShieldOff, Key } from 'lucide-preact'
import { admin, invites as invitesApi, type User } from '../../api/endpoints'
import { AdminTableSkeleton } from '../Skeleton'
import { getAvatarUrl } from '../../utils/avatar'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmModal'
import { getInviteStatus } from '../../utils/invites'
import { queryKeys } from '../../api/queryKeys'
import { filterInvites, countInvitesByStatus, filterMembers, countMembers } from '../../utils/adminFilters'
import { confirmThenMutate } from './confirmThenMutate'

export function AdminOverview({ currentUser }: { currentUser: User | null }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [inviteFilter, setInviteFilter] = useState<'all' | 'active' | 'used' | 'revoked' | 'expired'>('active')
  const [inviteQuery, setInviteQuery] = useState('')
  const [memberFilter, setMemberFilter] = useState<'all' | 'active' | 'disabled' | 'moderators'>('active')
  const [memberQuery, setMemberQuery] = useState('')
  const [transferQuery, setTransferQuery] = useState('')
  const [resetLink, setResetLink] = useState<{ url: string; username: string } | null>(null)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: admin.stats,
  })

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: admin.users,
  })

  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: queryKeys.admin.invites(),
    queryFn: invitesApi.list,
  })

  const createInvite = useMutation({
    mutationFn: invitesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.invites() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats() })
      toast.success('Invite created')
    },
    onError: () => {
      toast.error('Failed to create invite')
    },
  })

  const revokeInvite = useMutation({
    mutationFn: (token: string) => invitesApi.revoke(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.invites() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats() })
      toast.success('Invite revoked')
    },
    onError: () => {
      toast.error('Failed to revoke invite')
    },
  })

  const disableUser = useMutation({
    mutationFn: admin.disableUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
      toast.success('User disabled')
    },
    onError: () => {
      toast.error('Failed to disable user')
    },
  })

  const enableUser = useMutation({
    mutationFn: admin.enableUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
      toast.success('User enabled')
    },
    onError: () => {
      toast.error('Failed to enable user')
    },
  })

  const promoteUser = useMutation({
    mutationFn: admin.promoteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
      toast.success('Promoted to moderator')
    },
    onError: () => {
      toast.error('Failed to promote user')
    },
  })

  const demoteUser = useMutation({
    mutationFn: admin.demoteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
      toast.success('Demoted to member')
    },
    onError: () => {
      toast.error('Failed to demote user')
    },
  })

  const removeUser = useMutation({
    mutationFn: admin.removeUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
      toast.success('User removed')
    },
    onError: () => {
      toast.error('Failed to remove user')
    },
  })

  const transferOwnership = useMutation({
    mutationFn: admin.transferOwnership,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
      toast.success('Ownership transferred')
    },
    onError: () => {
      toast.error('Failed to transfer ownership')
    },
  })

  const revokeUserSessions = useMutation({
    mutationFn: admin.revokeUserSessions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.audit() })
      toast.success('Sessions revoked')
    },
    onError: () => {
      toast.error('Failed to revoke sessions')
    },
  })

  const resetPassword = useMutation({
    mutationFn: ({ userId }: { userId: string; username: string }) => admin.resetPassword(userId),
    onSuccess: (data, { username }) => {
      setResetLink({ url: `${window.location.origin}/reset-password?token=${data.token}`, username })
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.audit() })
    },
    onError: () => toast.error('Failed to generate reset link'),
  })

  const handleCopyResetLink = (url: string) => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Reset link copied')
      } catch {
        toast.error('Clipboard unavailable — copy the link manually')
      }
    })()
  }

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

  const handleDisableUser = (userId: string) =>
    confirmThenMutate(
      confirm,
      {
        title: 'Disable User',
        message: 'They will be logged out and cannot log back in.',
        confirmText: 'Disable',
        danger: true,
      },
      () => disableUser.mutate(userId)
    )

  const handleRemoveUser = (userId: string) =>
    confirmThenMutate(
      confirm,
      {
        title: 'Remove User',
        message: 'This removes the user and their content.',
        confirmText: 'Remove',
        danger: true,
      },
      () => removeUser.mutate(userId)
    )

  const handleTransferOwnership = (userId: string, username: string) =>
    confirmThenMutate(
      confirm,
      {
        title: 'Transfer Ownership',
        message: `This will make @${username} the owner and demote you to member. This cannot be undone.`,
        confirmText: 'Transfer',
        danger: true,
      },
      () => transferOwnership.mutate(userId)
    )

  const handleRevokeUserSessions = (userId: string, username: string) =>
    confirmThenMutate(
      confirm,
      {
        title: 'Revoke All Sessions',
        message: `This will immediately log out @${username} from all devices.`,
        confirmText: 'Revoke',
        danger: true,
      },
      () => revokeUserSessions.mutate(userId)
    )

  const handleResetPassword = (userId: string, username: string) =>
    confirmThenMutate(
      confirm,
      {
        title: 'Reset Password',
        message: `This will generate a one-time password reset link for @${username}.`,
        confirmText: 'Generate Link',
      },
      () => resetPassword.mutate({ userId, username })
    )

  const statCards = [
    { icon: Users, label: 'Total Users', value: stats?.users ?? 0, color: 'bg-blue-500' },
    { icon: FileText, label: 'Total Posts', value: stats?.posts ?? 0, color: 'bg-green-500' },
    { icon: Mail, label: 'Active Invites', value: stats?.invites ?? 0, color: 'bg-purple-500' },
  ]

  const inviteItems = invites ?? []
  const inviteCounts = countInvitesByStatus(inviteItems)
  const filteredInvites = filterInvites(inviteItems, inviteFilter, inviteQuery)

  const memberItems = users ?? []
  const memberCounts = countMembers(memberItems)
  const filteredMembers = filterMembers(memberItems, memberFilter, memberQuery)

  return (
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
              aria-label="Search invites"
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
          <AdminTableSkeleton count={3} />
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
              aria-label="Search members"
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
          <AdminTableSkeleton count={5} />
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
                      loading="lazy"
                      decoding="async"
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

                        <button
                          onClick={() => handleRevokeUserSessions(member.id, member.username)}
                          disabled={revokeUserSessions.isPending}
                          className="px-3 py-2 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                          <ShieldOff size={14} className="inline mr-1" />
                          Revoke Sessions
                        </button>

                        {!isSelf && (
                          <button
                            onClick={() => handleResetPassword(member.id, member.username)}
                            disabled={resetPassword.isPending}
                            className="px-3 py-2 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            <Key size={14} className="inline mr-1" />
                            Reset Password
                          </button>
                        )}
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
          High-risk actions. Use with caution.
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-red-700 mb-2">Transfer Ownership</h3>
            <p className="text-xs text-red-600 mb-3">
              Enter a username to transfer ownership. You will be demoted to member.
            </p>
            <div className="relative">
              <input
                type="text"
                value={transferQuery}
                onInput={(e) => setTransferQuery((e.target as HTMLInputElement).value)}
                placeholder="Search by username..."
                aria-label="Search users for ownership transfer"
                className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300 transition-all"
              />
              {transferQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto z-10">
                  {memberItems
                    .filter(m =>
                      m.role !== 'admin' &&
                      !m.disabledAt &&
                      (m.username.toLowerCase().includes(transferQuery.toLowerCase()) ||
                       m.displayName.toLowerCase().includes(transferQuery.toLowerCase()))
                    )
                    .slice(0, 8)
                    .map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          handleTransferOwnership(member.id, member.username)
                          setTransferQuery('')
                        }}
                        disabled={transferOwnership.isPending}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-50 transition-colors text-left disabled:opacity-50"
                      >
                        <img
                          src={getAvatarUrl(member)}
                          alt={member.displayName}
                          className="w-8 h-8 rounded-full"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{member.displayName}</p>
                          <p className="text-xs text-gray-500 truncate">@{member.username}</p>
                        </div>
                      </button>
                    ))}
                  {memberItems.filter(m =>
                    m.role !== 'admin' &&
                    !m.disabledAt &&
                    (m.username.toLowerCase().includes(transferQuery.toLowerCase()) ||
                     m.displayName.toLowerCase().includes(transferQuery.toLowerCase()))
                  ).length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-400">No matching members</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-red-200">
            <h3 className="text-sm font-semibold text-red-700 mb-2">Coming Soon</h3>
            <div className="space-y-1 text-xs text-red-500">
              <div>• Export archive (download all data)</div>
              <div>• Delete network (permanent)</div>
            </div>
          </div>
        </div>
      </div>

      {resetLink && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setResetLink(null)}
          />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-accent-50">
                <Key size={24} className="text-accent-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Reset link ready</h3>
                <p className="text-gray-500 mt-1">
                  Send this link to @{resetLink.username}. It can be used once, expires in 24
                  hours, and won't be shown again.
                </p>
              </div>
            </div>
            <code className="block bg-gray-50 px-4 py-3 rounded-2xl text-sm font-mono text-gray-900 border border-gray-200 select-all break-all">
              {resetLink.url}
            </code>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleCopyResetLink(resetLink.url)}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Copy size={16} />
                Copy
              </button>
              <button
                onClick={() => setResetLink(null)}
                className="flex-1 py-3 px-4 rounded-2xl font-bold bg-accent-500 text-white hover:bg-accent-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
