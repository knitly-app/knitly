import { db } from "./core.js";

export const commentQueries = {
  createComment(postId, userId, content) {
    const result = db.prepare(`
      INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)
    `).run(postId, userId, content);
    return this.getComment(result.lastInsertRowid);
  },

  getComment(id) {
    return db.prepare(`
      SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
             u.username, u.display_name, u.avatar, u.role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ? AND c.deleted_at IS NULL
    `).get(id) || null;
  },

  getComments(postId) {
    return db.prepare(`
      SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
             u.username, u.display_name, u.avatar, u.role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `).all(postId);
  },

  deleteComment(id) {
    const deletedAt = new Date().toISOString();
    db.prepare("UPDATE comments SET deleted_at = ? WHERE id = ?").run(deletedAt, id);
    return deletedAt;
  },

  getCommentsSince(postId, sinceId) {
    return db.prepare(`
      SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
             u.username, u.display_name, u.avatar, u.role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.id > ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
    `).all(postId, sinceId);
  },
};
