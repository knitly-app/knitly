import { db } from "./core.js";

export const apiKeyQueries = {
  createApiKey(userId, keyHash, label = '') {
    const result = db.prepare(`
      INSERT INTO api_keys (user_id, key_hash, label) VALUES (?, ?, ?)
    `).run(userId, keyHash, label);
    return result.lastInsertRowid;
  },

  getApiKeyByHash(keyHash) {
    return db.prepare(`
      SELECT ak.id, ak.user_id, ak.label, ak.last_used_at, ak.revoked_at, ak.created_at,
             u.email, u.username, u.display_name, u.bio, u.avatar, u.role, u.disabled_at
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = ? AND ak.revoked_at IS NULL
    `).get(keyHash) || null;
  },

  updateApiKeyLastUsed(keyId) {
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(keyId);
  },

  getApiKeysByUser(userId) {
    return db.prepare(`
      SELECT id, user_id, label, last_used_at, revoked_at, created_at
      FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);
  },

  revokeApiKey(keyId) {
    db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?").run(keyId);
  },

  revokeApiKeysByUser(userId) {
    db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").run(userId);
  },

  deleteApiKeysByUser(userId) {
    db.prepare("DELETE FROM api_keys WHERE user_id = ?").run(userId);
  },
};
