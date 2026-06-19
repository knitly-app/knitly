import { db } from "./core.js";

export const circleQueries = {
  createCircle(userId, name, color = "blue") {
    const result = db.prepare(`
      INSERT INTO circles (user_id, name, color) VALUES (?, ?, ?)
    `).run(userId, name, color);
    return this.getCircle(result.lastInsertRowid);
  },

  updateCircle(id, { name, color }) {
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name);
    }
    if (color !== undefined) {
      fields.push("color = ?");
      values.push(color);
    }

    if (fields.length === 0) return this.getCircle(id);

    values.push(id);
    db.prepare(`UPDATE circles SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return this.getCircle(id);
  },

  deleteCircle(id) {
    db.prepare("DELETE FROM circles WHERE id = ?").run(id);
  },

  getCircle(id) {
    return db.prepare(`
      SELECT c.id, c.user_id, c.name, c.color, c.created_at,
             u.username as owner_username, u.display_name as owner_display_name, u.avatar as owner_avatar
      FROM circles c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(id) || null;
  },

  getUserCircles(userId) {
    return db.prepare(`
      SELECT c.id, c.user_id, c.name, c.color, c.created_at,
             (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
      FROM circles c
      WHERE c.user_id = ?
      ORDER BY c.name ASC
    `).all(userId);
  },

  addCircleMember(circleId, userId) {
    db.prepare(`
      INSERT OR IGNORE INTO circle_members (circle_id, user_id) VALUES (?, ?)
    `).run(circleId, userId);
  },

  removeCircleMember(circleId, userId) {
    db.prepare("DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?").run(circleId, userId);
  },

  getCircleMembers(circleId) {
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.bio, cm.created_at as joined_at
      FROM circle_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.circle_id = ?
      ORDER BY cm.created_at ASC
    `).all(circleId);
  },

  getUserCircleMemberships(userId) {
    return db.prepare(`
      SELECT c.id, c.name, c.color, c.created_at,
             u.id as owner_id, u.username as owner_username, u.display_name as owner_display_name, u.avatar as owner_avatar
      FROM circle_members cm
      JOIN circles c ON cm.circle_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE cm.user_id = ?
      ORDER BY c.name ASC
    `).all(userId);
  },

  isCircleMember(circleId, userId) {
    return !!db.prepare("SELECT 1 FROM circle_members WHERE circle_id = ? AND user_id = ?").get(circleId, userId);
  },

  setPostCircles(postId, circleIds = []) {
    const tx = db.transaction((pId, cIds) => {
      db.prepare("DELETE FROM post_circles WHERE post_id = ?").run(pId);
      if (cIds.length > 0) {
        const insert = db.prepare("INSERT INTO post_circles (post_id, circle_id) VALUES (?, ?)");
        cIds.forEach(circleId => insert.run(pId, circleId));
      }
    });
    tx(postId, circleIds);
  },

  getPostCircles(postId) {
    return db.prepare("SELECT circle_id FROM post_circles WHERE post_id = ?")
      .all(postId)
      .map(row => row.circle_id);
  },

  getPostCirclesMap(postIds = []) {
    if (!postIds.length) return new Map();

    const placeholders = postIds.map(() => "?").join(", ");
    const rows = db.prepare(`
      SELECT pc.post_id, pc.circle_id
      FROM post_circles pc
      WHERE pc.post_id IN (${placeholders})
    `).all(...postIds);

    const map = new Map();
    postIds.forEach(id => map.set(id, []));
    rows.forEach(row => {
      map.get(row.post_id).push(row.circle_id);
    });
    return map;
  },

  getPostCirclesWithDetails(postId) {
    return db.prepare(`
      SELECT c.id, c.name, c.color
      FROM post_circles pc
      JOIN circles c ON pc.circle_id = c.id
      WHERE pc.post_id = ?
    `).all(postId);
  },

  canUserViewPost(viewerId, postId) {
    const post = db.prepare("SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL").get(postId);
    if (!post) return false;

    if (post.user_id === viewerId) return true;

    const circleCount = db.prepare("SELECT COUNT(*) as count FROM post_circles WHERE post_id = ?").get(postId).count;
    if (circleCount === 0) return true;

    const isMember = db.prepare(`
      SELECT 1 FROM post_circles pc
      JOIN circle_members cm ON pc.circle_id = cm.circle_id
      WHERE pc.post_id = ? AND cm.user_id = ?
      LIMIT 1
    `).get(postId, viewerId);

    return !!isMember;
  },
};
