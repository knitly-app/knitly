import { Database } from "bun:sqlite";
import crypto from "crypto";

const dbPath = process.env.DATABASE_PATH || "../knitly.db";
export const db = new Database(dbPath);

db.exec("PRAGMA foreign_keys = ON");

if (process.env.NODE_ENV === "production") {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA cache_size = -64000");
  db.exec("PRAGMA temp_store = MEMORY");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT,
    bio TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    location TEXT DEFAULT '',
    website TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reactions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'love',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS post_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    type TEXT NOT NULL DEFAULT 'image',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    email TEXT,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used INTEGER NOT NULL DEFAULT 0,
    used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER NOT NULL REFERENCES users(id),
    action_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
  CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
`);

const addColumnIfMissing = (statement) => {
  try {
    db.exec(statement);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("duplicate column name")) return;
    throw error;
  }
};

// Migrations for existing databases
addColumnIfMissing(`ALTER TABLE users ADD COLUMN location TEXT DEFAULT ''`);
addColumnIfMissing(`ALTER TABLE users ADD COLUMN website TEXT DEFAULT ''`);
addColumnIfMissing(`ALTER TABLE users ADD COLUMN disabled_at TEXT NULL`);
addColumnIfMissing(`ALTER TABLE invites ADD COLUMN revoked_at TEXT NULL`);
addColumnIfMissing(`ALTER TABLE posts ADD COLUMN deleted_at TEXT NULL`);
addColumnIfMissing(`ALTER TABLE comments ADD COLUMN deleted_at TEXT NULL`);

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export const dbUtils = {
  // USER
  getUserById(id) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, location, website, role, disabled_at, created_at
      FROM users WHERE id = ?
    `).get(id) || null;
  },

  getUserByEmail(email) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, location, website, password_hash, role, disabled_at, created_at
      FROM users WHERE email = ?
    `).get(email) || null;
  },

  getUserByUsername(username) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, location, website, password_hash, role, disabled_at, created_at
      FROM users WHERE username = ?
    `).get(username) || null;
  },

  createUser(email, username, displayName, passwordHash, role = "member") {
    const result = db.prepare(`
      INSERT INTO users (email, username, display_name, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, username, displayName, passwordHash, role);
    return result.lastInsertRowid;
  },

  updateUser(id, updates) {
    const fields = [];
    const values = [];

    if (updates.username !== undefined) {
      fields.push("username = ?");
      values.push(updates.username);
    }
    if (updates.displayName !== undefined) {
      fields.push("display_name = ?");
      values.push(updates.displayName);
    }
    if (updates.bio !== undefined) {
      fields.push("bio = ?");
      values.push(updates.bio);
    }
    if (updates.avatar !== undefined) {
      fields.push("avatar = ?");
      values.push(updates.avatar);
    }
    if (updates.location !== undefined) {
      fields.push("location = ?");
      values.push(updates.location);
    }
    if (updates.website !== undefined) {
      fields.push("website = ?");
      values.push(updates.website);
    }

    if (fields.length === 0) return;

    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  getAllUsers() {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, location, website, role, disabled_at, created_at
      FROM users ORDER BY created_at DESC
    `).all();
  },

  getAllUserIds(excludeId = null) {
    if (excludeId) {
      return db.prepare("SELECT id FROM users WHERE id != ?").all(excludeId).map(r => r.id);
    }
    return db.prepare("SELECT id FROM users").all().map(r => r.id);
  },

  // SESSION
  createSession(userId) {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + SESSION_EXPIRY_MS;

    db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, userId, expiresAt, now);

    return { sessionId, expiresAt };
  },

  getSession(sessionId) {
    return db.prepare(`
      SELECT
        s.id as session_id,
        s.user_id,
        s.expires_at,
        u.email,
        u.username,
        u.display_name,
        u.bio,
        u.avatar,
        u.location,
        u.website,
        u.role,
        u.disabled_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(sessionId, Date.now()) || null;
  },

  disableUser(userId) {
    const disabledAt = new Date().toISOString();
    db.prepare("UPDATE users SET disabled_at = ? WHERE id = ?").run(disabledAt, userId);
    return disabledAt;
  },

  enableUser(userId) {
    db.prepare("UPDATE users SET disabled_at = NULL WHERE id = ?").run(userId);
  },

  updateUserRole(userId, role) {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  },

  deleteUser(userId) {
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  },

  deleteSessionsByUser(userId) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  },

  transferOwnership(currentAdminId, newAdminId) {
    const tx = db.transaction((adminId, targetId) => {
      db.prepare("UPDATE users SET role = 'member' WHERE id = ?").run(adminId);
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(targetId);
    });
    tx(currentAdminId, newAdminId);
  },

  deleteSession(sessionId) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  },

  // POST
  createPost(userId, content, media = []) {
    const result = db.prepare(`
      INSERT INTO posts (user_id, content, media_url) VALUES (?, ?, ?)
    `).run(userId, content, null);

    const postId = result.lastInsertRowid;
    this.addPostMedia(postId, media);
    return this.getPost(postId);
  },

  getPost(id) {
    const post = db.prepare(`
      SELECT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `).get(id) || null;

    if (!post) return null;
    const mediaMap = this.getPostMediaMap([post.id]);
    const media = mediaMap.get(post.id) || [];
    const fallback = post.media_url ? [{ url: post.media_url, type: "image", sortOrder: 0 }] : [];
    return {
      ...post,
      media: media.length ? media : fallback,
      reactions: this.getReactionCounts(post.id),
    };
  },

  getFeed(limit = 50, cursor = null) {
    let query = `
      SELECT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.deleted_at IS NULL
    `;

    if (cursor) {
      query += ` AND p.created_at < ? ORDER BY p.created_at DESC LIMIT ?`;
      const rows = db.prepare(query).all(cursor, limit + 1);
      return this.attachMediaAndReactions(rows);
    }

    query += ` ORDER BY p.created_at DESC LIMIT ?`;
    const rows = db.prepare(query).all(limit + 1);
    return this.attachMediaAndReactions(rows);
  },

  deletePost(id) {
    const deletedAt = new Date().toISOString();
    db.prepare("UPDATE posts SET deleted_at = ? WHERE id = ?").run(deletedAt, id);
    return deletedAt;
  },

  updatePost(id, content) {
    db.prepare("UPDATE posts SET content = ? WHERE id = ?").run(content, id);
    return this.getPost(id);
  },

  getUserPosts(userId, limit = 50) {
    const rows = db.prepare(`
      SELECT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ? AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(userId, limit);
    return this.attachMediaAndReactions(rows);
  },

  addPostMedia(postId, media = []) {
    if (!Array.isArray(media) || media.length === 0) return;

    const insert = db.prepare(`
      INSERT INTO post_media (post_id, url, width, height, type, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((items) => {
      items.forEach((item, index) => {
        insert.run(
          postId,
          item.url,
          item.width ?? null,
          item.height ?? null,
          item.type || "image",
          item.sortOrder ?? index
        );
      });
    });

    tx(media);
  },

  getPostMediaMap(postIds = []) {
    if (!postIds.length) return new Map();

    const placeholders = postIds.map(() => "?").join(", ");
    const rows = db.prepare(`
      SELECT id, post_id, url, width, height, type, sort_order
      FROM post_media
      WHERE post_id IN (${placeholders})
      ORDER BY sort_order ASC, id ASC
    `).all(...postIds);

    const map = new Map();
    rows.forEach((row) => {
      if (!map.has(row.post_id)) map.set(row.post_id, []);
      map.get(row.post_id).push({
        id: row.id,
        url: row.url,
        width: row.width,
        height: row.height,
        type: row.type,
        sortOrder: row.sort_order,
      });
    });
    return map;
  },

  attachMedia(posts = []) {
    if (!posts.length) return posts;
    const ids = posts.map((p) => p.id);
    const mediaMap = this.getPostMediaMap(ids);

    return posts.map((post) => {
      const media = mediaMap.get(post.id) || [];
      const fallback = post.media_url ? [{ url: post.media_url, type: "image", sortOrder: 0 }] : [];
      return {
        ...post,
        media: media.length ? media : fallback,
      };
    });
  },

  attachMediaAndReactions(posts = []) {
    if (!posts.length) return posts;
    const ids = posts.map((p) => p.id);
    const mediaMap = this.getPostMediaMap(ids);
    const reactionsMap = this.getReactionCountsMap(ids);

    return posts.map((post) => {
      const media = mediaMap.get(post.id) || [];
      const fallback = post.media_url ? [{ url: post.media_url, type: "image", sortOrder: 0 }] : [];
      return {
        ...post,
        media: media.length ? media : fallback,
        reactions: reactionsMap.get(post.id) || {},
      };
    });
  },

  // REACTIONS
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

  // COMMENT
  createComment(postId, userId, content) {
    const result = db.prepare(`
      INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)
    `).run(postId, userId, content);
    return this.getComment(result.lastInsertRowid);
  },

  getComment(id) {
    return db.prepare(`
      SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
             u.username, u.display_name, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ? AND c.deleted_at IS NULL
    `).get(id) || null;
  },

  getComments(postId) {
    return db.prepare(`
      SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
             u.username, u.display_name, u.avatar
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

  getModerationFeed({ limit = 50, cursor = null, query = "" } = {}) {
    const params = [];
    const hasQuery = typeof query === "string" && query.trim().length > 0;
    const pattern = hasQuery ? `%${query.trim()}%` : null;

    const postWhere = ["p.deleted_at IS NULL"];
    if (hasQuery) {
      postWhere.push("(p.content LIKE ? OR u.username LIKE ? OR u.display_name LIKE ?)");
      params.push(pattern, pattern, pattern);
    }

    const commentWhere = ["c.deleted_at IS NULL", "p.deleted_at IS NULL"];
    if (hasQuery) {
      commentWhere.push(
        "(c.content LIKE ? OR u.username LIKE ? OR u.display_name LIKE ? OR p.content LIKE ? OR pu.username LIKE ? OR pu.display_name LIKE ?)"
      );
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }

    const union = `
      SELECT
        'post' as type,
        p.id as id,
        p.created_at as created_at,
        p.content as content,
        p.user_id as user_id,
        u.username as username,
        u.display_name as display_name,
        u.avatar as avatar,
        NULL as post_id,
        NULL as post_content,
        NULL as post_author_username,
        NULL as post_author_display_name,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments_count,
        (SELECT COUNT(*) FROM post_media WHERE post_id = p.id) as media_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE ${postWhere.join(" AND ")}
      UNION ALL
      SELECT
        'comment' as type,
        c.id as id,
        c.created_at as created_at,
        c.content as content,
        c.user_id as user_id,
        u.username as username,
        u.display_name as display_name,
        u.avatar as avatar,
        c.post_id as post_id,
        p.content as post_content,
        pu.username as post_author_username,
        pu.display_name as post_author_display_name,
        NULL as comments_count,
        NULL as media_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN posts p ON c.post_id = p.id
      JOIN users pu ON p.user_id = pu.id
      WHERE ${commentWhere.join(" AND ")}
    `;

    let querySql = `SELECT * FROM (${union})`;
    if (cursor) {
      const [cursorCreatedAt, cursorIdRaw] = String(cursor).split("|");
      const cursorId = Number.parseInt(cursorIdRaw ?? "", 10);
      if (cursorCreatedAt && Number.isFinite(cursorId)) {
        querySql += " WHERE (created_at < ? OR (created_at = ? AND id < ?))";
        params.push(cursorCreatedAt, cursorCreatedAt, cursorId);
      }
    }

    querySql += " ORDER BY created_at DESC, id DESC LIMIT ?";
    params.push(limit + 1);
    return db.prepare(querySql).all(...params);
  },

  // FOLLOW
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

  // NOTIFICATION
  createNotification(userId, type, actorId, postId = null) {
    db.prepare(`
      INSERT INTO notifications (user_id, type, actor_id, post_id)
      VALUES (?, ?, ?, ?)
    `).run(userId, type, actorId, postId);
  },

  getNotifications(userId, limit = 50) {
    return db.prepare(`
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
  },

  markNotificationRead(id, userId) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, userId);
  },

  markAllNotificationsRead(userId) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(userId);
  },

  // INVITE
  createInvite(invitedBy) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO invites (token, invited_by, expires_at) VALUES (?, ?, ?)
    `).run(token, invitedBy, expiresAt);
    return { token, expiresAt };
  },

  getInviteByToken(token) {
    return db.prepare("SELECT * FROM invites WHERE token = ?").get(token) || null;
  },

  listInvites() {
    return db.prepare(`
      SELECT i.*, u.username as inviter_username, u.display_name as inviter_name,
             ub.username as used_by_username, ub.display_name as used_by_name
      FROM invites i
      LEFT JOIN users u ON i.invited_by = u.id
      LEFT JOIN users ub ON i.used_by = ub.id
      ORDER BY i.created_at DESC
    `).all();
  },

  markInviteUsed(id, userId) {
    db.prepare("UPDATE invites SET used = 1, used_by = ? WHERE id = ?").run(userId, id);
  },

  revokeInviteByToken(token) {
    const revokedAt = new Date().toISOString();
    db.prepare("UPDATE invites SET revoked_at = ? WHERE token = ?").run(revokedAt, token);
    return revokedAt;
  },

  // SEARCH
  searchUsers(query, limit = 20) {
    const pattern = `%${query}%`;
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, location, website
      FROM users
      WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ?
      LIMIT ?
    `).all(pattern, pattern, pattern, limit);
  },

  searchPosts(query, limit = 50) {
    const pattern = `%${query}%`;
    const rows = db.prepare(`
      SELECT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.content LIKE ? AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(pattern, limit);
    return this.attachMediaAndReactions(rows);
  },

  // STATS
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

  // AUDIT LOG
  createAuditEntry(actorId, actionType, targetType, targetId = null, metadata = null) {
    db.prepare(`
      INSERT INTO audit_log (actor_user_id, action_type, target_type, target_id, metadata_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(actorId, actionType, targetType, targetId, metadata ? JSON.stringify(metadata) : null);
  },

  getAuditLog({ limit = 50, cursor = null } = {}) {
    let query = `
      SELECT
        a.id, a.action_type, a.target_type, a.target_id, a.metadata_json, a.created_at,
        u.id as actor_id, u.username as actor_username, u.display_name as actor_display_name
      FROM audit_log a
      JOIN users u ON a.actor_user_id = u.id
    `;

    const params = [];
    if (cursor) {
      const [cursorCreatedAt, cursorIdRaw] = String(cursor).split("|");
      const cursorId = Number.parseInt(cursorIdRaw ?? "", 10);
      if (cursorCreatedAt && Number.isFinite(cursorId)) {
        query += " WHERE (a.created_at < ? OR (a.created_at = ? AND a.id < ?)) ";
        params.push(cursorCreatedAt, cursorCreatedAt, cursorId);
      }
    }

    query += " ORDER BY a.created_at DESC, a.id DESC LIMIT ?";
    params.push(limit + 1);

    return db.prepare(query).all(...params);
  },
};

export default db;
