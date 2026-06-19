import { db } from "./core.js";

export const followQueries = {
  follow(followerId, followingId) {
    db.prepare(`INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)`).run(followerId, followingId);
  },

  unfollow(followerId, followingId) {
    db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(followerId, followingId);
  },

  isFollowing(followerId, followingId) {
    return !!db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?`).get(followerId, followingId);
  },

  getFollowers(userId) {
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.bio
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ?
    `).all(userId);
  },

  getFollowing(userId) {
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.bio
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ?
    `).all(userId);
  },

  getFollowerCount(userId) {
    return db.prepare("SELECT COUNT(*) as count FROM follows WHERE following_id = ?").get(userId).count;
  },

  getFollowingCount(userId) {
    return db.prepare("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?").get(userId).count;
  },
};
