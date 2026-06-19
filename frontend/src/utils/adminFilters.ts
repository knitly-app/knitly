import { getInviteStatus, type InviteStatus } from './invites'

export interface AdminInvite {
  token: string
  used: boolean
  createdAt?: string
  expiresAt?: string
  revokedAt?: string | null
  invitedBy?: { username?: string } | null
  usedBy?: { username?: string } | null
}

export type InviteFilter = 'all' | InviteStatus
export type InviteCounts = Record<'all' | InviteStatus, number>

export function countInvitesByStatus(invites: AdminInvite[]): InviteCounts {
  return invites.reduce<InviteCounts>(
    (counts, invite) => {
      counts.all++
      counts[getInviteStatus(invite)]++
      return counts
    },
    { all: 0, active: 0, used: 0, revoked: 0, expired: 0 }
  )
}

export function filterInvites<T extends AdminInvite>(invites: T[], filter: InviteFilter, query: string): T[] {
  const q = query.trim().toLowerCase()
  return invites.filter((invite) => {
    const status = getInviteStatus(invite)
    if (filter !== 'all' && filter !== status) return false
    if (!q) return true
    return (
      invite.token.toLowerCase().includes(q) ||
      (invite.usedBy?.username?.toLowerCase().includes(q) ?? false) ||
      (invite.invitedBy?.username?.toLowerCase().includes(q) ?? false)
    )
  })
}

export interface AdminMember {
  username?: string
  displayName?: string
  role?: string
  disabledAt?: string | null
}

export type MemberFilter = 'all' | 'active' | 'disabled' | 'moderators'
export type MemberCounts = Record<MemberFilter, number>

export function countMembers(members: AdminMember[]): MemberCounts {
  return members.reduce<MemberCounts>(
    (counts, member) => {
      counts.all++
      if (member.disabledAt) counts.disabled++
      else counts.active++
      if (member.role === 'moderator') counts.moderators++
      return counts
    },
    { all: 0, active: 0, disabled: 0, moderators: 0 }
  )
}

export function filterMembers<T extends AdminMember>(members: T[], filter: MemberFilter, query: string): T[] {
  const q = query.trim().toLowerCase()
  return members.filter((member) => {
    if (filter === 'disabled' && !member.disabledAt) return false
    if (filter === 'active' && member.disabledAt) return false
    if (filter === 'moderators' && member.role !== 'moderator') return false
    if (!q) return true
    const name = member.displayName?.toLowerCase() ?? ''
    const username = member.username?.toLowerCase() ?? ''
    return name.includes(q) || username.includes(q)
  })
}
