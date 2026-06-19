import { db } from "./core.js";

export const reactionQueries = {
  addReaction(userId, postId, reactionType) {
    db.prepare(`
      INSERT INTO reactions (user_id, post_id, reaction_type) VALUES (?, ?, ?)
      ON CONFLICT(user_id, post_id) DO UPDATE SET reaction_type = excluded.reaction_type
    `).run(userId, postId, reactionType);
  },

  removeReaction(userId, postId) {
    db.prepare("DELETE FROM reactions WHERE user_id = ? AND post_id = ?").run(userId, postId);
  },

  getUserReaction(userId, postId) {
    const row = db.prepare("SELECT reaction_type FROM reactions WHERE user_id = ? AND post_id = ?").get(userId, postId);
    return row ? row.reaction_type : null;
  },

  getReactionCounts(postId) {
    const rows = db.prepare(`
      SELECT reaction_type, COUNT(*) as count
      FROM reactions WHERE post_id = ?
      GROUP BY reaction_type
    `).all(postId);
    return Object.fromEntries(rows.map(r => [r.reaction_type, r.count]));
  },

  getReactionCountsMap(postIds = []) {
    if (!postIds.length) return new Map();
    const placeholders = postIds.map(() => "?").join(", ");
    const rows = db.prepare(`
      SELECT post_id, reaction_type, COUNT(*) as count
      FROM reactions
      WHERE post_id IN (${placeholders})
      GROUP BY post_id, reaction_type
    `).all(...postIds);

    const map = new Map();
    postIds.forEach(id => map.set(id, {}));
    rows.forEach(row => {
      if (!map.has(row.post_id)) map.set(row.post_id, {});
      map.get(row.post_id)[row.reaction_type] = row.count;
    });
    return map;
  },

  getUserReactionsMap(userId, postIds = []) {
    if (!postIds.length) return new Map();
    const placeholders = postIds.map(() => "?").join(", ");
    const rows = db.prepare(`
      SELECT post_id, reaction_type
      FROM reactions
      WHERE user_id = ? AND post_id IN (${placeholders})
    `).all(userId, ...postIds);

    const map = new Map();
    rows.forEach(row => map.set(row.post_id, row.reaction_type));
    return map;
  },
};
