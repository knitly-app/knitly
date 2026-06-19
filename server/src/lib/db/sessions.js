import crypto from "crypto";
import { db, SESSION_EXPIRY_MS } from "./core.js";

export const sessionQueries = {
  createSession(userId) {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + SESSION_EXPIRY_MS;

    db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, userId, expiresAt, now);

    return { sessionId, expiresAt };
  },

  getSession(sessionId) {
    return db.prepare(`
      SELECT
        s.id as session_id,
        s.user_id,
        s.expires_at,
        u.email,
        u.username,
        u.display_name,
        u.bio,
        u.avatar,
        u.location,
        u.website,
        u.role,
        u.disabled_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(sessionId, Date.now()) || null;
  },

  deleteSession(sessionId) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  },

  deleteSessionsByUser(userId) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  },

  transferOwnership(currentAdminId, newAdminId) {
    const tx = db.transaction((adminId, targetId) => {
      db.prepare("UPDATE users SET role = 'member' WHERE id = ?").run(adminId);
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(targetId);
    });
    tx(currentAdminId, newAdminId);
  },
};
