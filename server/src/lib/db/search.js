import { db } from "./core.js";

export const searchQueries = {
  searchUsers(query, limit = 20) {
    const pattern = `%${query}%`;
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, location, website
      FROM users
      WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ?
      LIMIT ?
    `).all(pattern, pattern, pattern, limit);
  },

  searchPosts(query, limit = 50, viewerId = null) {
    const pattern = `%${query}%`;
    const rows = db.prepare(`
      SELECT DISTINCT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar, u.role,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_circles pc ON p.id = pc.post_id
      LEFT JOIN circle_members cm ON pc.circle_id = cm.circle_id AND cm.user_id = ?
      WHERE p.content LIKE ? AND p.deleted_at IS NULL
        AND (
          pc.post_id IS NULL
          OR p.user_id = ?
          OR cm.user_id IS NOT NULL
        )
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(viewerId, pattern, viewerId, limit);
    return this.attachMediaAndReactions(rows);
  },
};
