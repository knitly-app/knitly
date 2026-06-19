import { db } from "./core.js";

export const chatQueries = {
  getChatMessages(sinceId = 0, limit = 100) {
    return db.prepare(`
      SELECT m.id, m.user_id, m.content, m.created_at,
             u.username, u.display_name, u.avatar, u.role
      FROM chat_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id > ?
      ORDER BY m.id ASC
      LIMIT ?
    `).all(sinceId, limit);
  },

  createChatMessage(userId, content) {
    const result = db.prepare(`
      INSERT INTO chat_messages (user_id, content) VALUES (?, ?)
    `).run(userId, content);
    return db.prepare(`
      SELECT m.id, m.user_id, m.content, m.created_at,
             u.username, u.display_name, u.avatar, u.role
      FROM chat_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);
  },

  getRecentChatMessage(userId, content, withinSeconds = 30) {
    const cutoff = new Date(Date.now() - withinSeconds * 1000).toISOString();
    return db.prepare(`
      SELECT 1 FROM chat_messages
      WHERE user_id = ? AND content = ? AND created_at > ?
      LIMIT 1
    `).get(userId, content, cutoff);
  },

  cleanupOldChatMessages(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
    return db.prepare("DELETE FROM chat_messages WHERE created_at < ?").run(cutoff);
  },

  updateChatPresence(userId) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO chat_presence (user_id, last_seen) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen
    `).run(userId, now);
  },

  getChatOnlineUsers(withinSeconds = 60) {
    const cutoff = new Date(Date.now() - withinSeconds * 1000).toISOString();
    return db.prepare(`
      SELECT p.user_id, u.username, u.display_name, u.avatar
      FROM chat_presence p
      JOIN users u ON p.user_id = u.id
      WHERE p.last_seen > ?
    `).all(cutoff);
  },

  cleanupStalePresence(olderThanSeconds = 60) {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
    return db.prepare("DELETE FROM chat_presence WHERE last_seen < ?").run(cutoff);
  },

  removeChatPresence(userId) {
    db.prepare("DELETE FROM chat_presence WHERE user_id = ?").run(userId);
  },
};
