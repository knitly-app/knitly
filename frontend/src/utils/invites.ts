export type InviteStatus = 'used' | 'revoked' | 'expired' | 'active'

export function getInviteStatus(invite: {
  used: boolean
  revokedAt?: string | null
  expiresAt?: string
}): InviteStatus {
  if (invite.used) return 'used'
  if (invite.revokedAt) return 'revoked'
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) return 'expired'
  return 'active'
}
