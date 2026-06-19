import { db } from "./core.js";

export const tokenQueries = {
  createResetToken(userId, tokenHash, expiresAt) {
    const tx = db.transaction((uid, hash, exp) => {
      db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(uid);
      db.prepare(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)
      `).run(uid, hash, exp);
    });
    tx(userId, tokenHash, expiresAt);
  },

  getResetToken(tokenHash) {
    return db.prepare(`
      SELECT t.id, t.user_id, t.expires_at,
             u.email, u.username, u.display_name, u.disabled_at
      FROM password_reset_tokens t
      JOIN users u ON t.user_id = u.id
      WHERE t.token_hash = ?
    `).get(tokenHash) || null;
  },

  deleteResetToken(tokenHash) {
    db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(tokenHash);
  },

  deleteResetTokensByUser(userId) {
    db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(userId);
  },

  createEmailChangeToken(userId, newEmail, tokenHash, expiresAt) {
    const tx = db.transaction((uid, email, hash, exp) => {
      db.prepare("DELETE FROM email_change_tokens WHERE user_id = ?").run(uid);
      db.prepare(`
        INSERT INTO email_change_tokens (user_id, new_email, token_hash, expires_at) VALUES (?, ?, ?, ?)
      `).run(uid, email, hash, exp);
    });
    tx(userId, newEmail, tokenHash, expiresAt);
  },

  getEmailChangeToken(tokenHash) {
    return db.prepare(`
      SELECT t.id, t.user_id, t.new_email, t.expires_at,
             u.email, u.username, u.display_name, u.disabled_at
      FROM email_change_tokens t
      JOIN users u ON t.user_id = u.id
      WHERE t.token_hash = ?
    `).get(tokenHash) || null;
  },

  deleteEmailChangeToken(tokenHash) {
    db.prepare("DELETE FROM email_change_tokens WHERE token_hash = ?").run(tokenHash);
  },

  deleteEmailChangeTokensByUser(userId) {
    db.prepare("DELETE FROM email_change_tokens WHERE user_id = ?").run(userId);
  },
};
