import { describe, it, expect } from 'bun:test'
import {
  filterInvites,
  countInvitesByStatus,
  filterMembers,
  countMembers,
  type AdminInvite,
  type AdminMember,
} from '../../utils/adminFilters'

const future = new Date(Date.now() + 86_400_000).toISOString()
const past = new Date(Date.now() - 86_400_000).toISOString()

const invites: AdminInvite[] = [
  { token: 'AAA111', used: false, expiresAt: future, invitedBy: { username: 'owner' } },
  { token: 'BBB222', used: true, expiresAt: future, usedBy: { username: 'newbie' } },
  { token: 'CCC333', used: false, revokedAt: past },
  { token: 'DDD444', used: false, expiresAt: past },
]

describe('countInvitesByStatus', () => {
  it('counts by derived status', () => {
    expect(countInvitesByStatus(invites)).toEqual({
      all: 4, active: 1, used: 1, revoked: 1, expired: 1,
    })
  })
})

describe('filterInvites', () => {
  it('returns all when filter is all and query empty', () => {
    expect(filterInvites(invites, 'all', '').length).toBe(4)
  })

  it('filters by status', () => {
    expect(filterInvites(invites, 'active', '').map((i) => i.token)).toEqual(['AAA111'])
    expect(filterInvites(invites, 'revoked', '').map((i) => i.token)).toEqual(['CCC333'])
  })

  it('matches token, usedBy and invitedBy usernames (case-insensitive, trimmed)', () => {
    expect(filterInvites(invites, 'all', '  aaa ').map((i) => i.token)).toEqual(['AAA111'])
    expect(filterInvites(invites, 'all', 'NEWBIE').map((i) => i.token)).toEqual(['BBB222'])
    expect(filterInvites(invites, 'all', 'owner').map((i) => i.token)).toEqual(['AAA111'])
  })

  it('combines status and query', () => {
    expect(filterInvites(invites, 'used', 'newbie').map((i) => i.token)).toEqual(['BBB222'])
    expect(filterInvites(invites, 'active', 'newbie')).toEqual([])
  })
})

const members: AdminMember[] = [
  { username: 'alice', displayName: 'Alice', role: 'admin', disabledAt: null },
  { username: 'mod', displayName: 'Mod Person', role: 'moderator', disabledAt: null },
  { username: 'banned', displayName: 'Banned Guy', role: 'member', disabledAt: past },
]

describe('countMembers', () => {
  it('counts active/disabled/moderators', () => {
    expect(countMembers(members)).toEqual({ all: 3, active: 2, disabled: 1, moderators: 1 })
  })
})

describe('filterMembers', () => {
  it('filters by status', () => {
    expect(filterMembers(members, 'active', '').map((m) => m.username)).toEqual(['alice', 'mod'])
    expect(filterMembers(members, 'disabled', '').map((m) => m.username)).toEqual(['banned'])
    expect(filterMembers(members, 'moderators', '').map((m) => m.username)).toEqual(['mod'])
  })

  it('matches displayName and username (case-insensitive, trimmed)', () => {
    expect(filterMembers(members, 'all', ' ALICE ').map((m) => m.username)).toEqual(['alice'])
    expect(filterMembers(members, 'all', 'person').map((m) => m.username)).toEqual(['mod'])
  })
})
