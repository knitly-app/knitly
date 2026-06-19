import crypto from "crypto";
import { db } from "./core.js";

export const inviteQueries = {
  createInvite(invitedBy) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO invites (token, invited_by, expires_at) VALUES (?, ?, ?)
    `).run(token, invitedBy, expiresAt);
    return { token, expiresAt };
  },

  getInviteByToken(token) {
    return db.prepare("SELECT * FROM invites WHERE token = ?").get(token) || null;
  },

  listInvites() {
    return db.prepare(`
      SELECT i.*, u.username as inviter_username, u.display_name as inviter_name,
             ub.username as used_by_username, ub.display_name as used_by_name
      FROM invites i
      LEFT JOIN users u ON i.invited_by = u.id
      LEFT JOIN users ub ON i.used_by = ub.id
      ORDER BY i.created_at DESC
    `).all();
  },

  markInviteUsed(id, userId) {
    db.prepare("UPDATE invites SET used = 1, used_by = ? WHERE id = ?").run(userId, id);
  },

  revokeInviteByToken(token) {
    const revokedAt = new Date().toISOString();
    db.prepare("UPDATE invites SET revoked_at = ? WHERE token = ?").run(revokedAt, token);
    return revokedAt;
  },
};
