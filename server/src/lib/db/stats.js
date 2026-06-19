import { db } from "./core.js";

export const statsQueries = {
  getStats() {
    const users = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const posts = db.prepare("SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NULL").get().count;
    const nowIso = new Date().toISOString();
    const invites = db.prepare(`
      SELECT COUNT(*) as count
      FROM invites
      WHERE used = 0
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
    `).get(nowIso).count;
    return { users, posts, invites };
  },

  needsSetup() {
    const result = db.prepare("SELECT COUNT(*) as count FROM users").get();
    return result.count === 0;
  },
};
