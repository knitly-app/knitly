import { describe, it, expect } from 'bun:test'
import { formatAuditAction } from '../../utils/adminAudit'

describe('formatAuditAction', () => {
  it('maps known action types to labels', () => {
    expect(formatAuditAction('USER_DISABLED')).toBe('Disabled user')
    expect(formatAuditAction('BOT_KEY_REVOKED')).toBe('Revoked bot key')
  })

  it('falls back to the raw action for unknown types', () => {
    expect(formatAuditAction('SOMETHING_NEW')).toBe('SOMETHING_NEW')
  })
})
