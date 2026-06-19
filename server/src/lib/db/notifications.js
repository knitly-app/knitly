import { db } from "./core.js";

export const notificationQueries = {
  createNotification(userId, type, actorId, postId = null) {
    db.prepare(`
      INSERT INTO notifications (user_id, type, actor_id, post_id)
      VALUES (?, ?, ?, ?)
    `).run(userId, type, actorId, postId);
  },

  getNotifications(userId, limit = 50) {
    const rows = db.prepare(`
      SELECT
        n.id, n.type, n.post_id, n.read, n.created_at,
        n.actor_id as from_user_id,
        a.username as from_username,
        a.display_name as from_display_name,
        a.avatar as from_avatar
      FROM notifications n
      JOIN users a ON n.actor_id = a.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ?
    `).all(userId, limit);

    return rows.filter(n => {
      if (!n.post_id) return true;
      return this.canUserViewPost(userId, n.post_id);
    });
  },

  markNotificationRead(id, userId) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, userId);
  },

  markAllNotificationsRead(userId) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(userId);
  },

  clearAllNotifications(userId) {
    db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
  },
};
