const AUDIT_ACTION_LABELS: Record<string, string> = {
  USER_DISABLED: 'Disabled user',
  USER_ENABLED: 'Enabled user',
  USER_PROMOTED_MODERATOR: 'Promoted to moderator',
  USER_DEMOTED_MODERATOR: 'Demoted from moderator',
  OWNERSHIP_TRANSFERRED: 'Transferred ownership',
  USER_REMOVED: 'Removed user',
  CONTENT_DELETED: 'Deleted content',
  INVITE_CREATED: 'Created invite',
  INVITE_REVOKED: 'Revoked invite',
  SESSIONS_REVOKED: 'Revoked sessions',
  PASSWORD_RESET_GENERATED: 'Generated password reset link',
  PASSWORD_RESET_COMPLETED: 'Completed password reset',
  BOT_CREATED: 'Created bot',
  BOT_DELETED: 'Deleted bot',
  BOT_KEY_REGENERATED: 'Regenerated bot key',
  BOT_KEY_REVOKED: 'Revoked bot key',
}

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] || action
}
