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

  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
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

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
  CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
`);

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export const dbUtils = {
  // USER
  getUserById(id) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, role, created_at
      FROM users WHERE id = ?
    `).get(id) || null;
  },

  getUserByEmail(email) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, password_hash, role, created_at
      FROM users WHERE email = ?
    `).get(email) || null;
  },

  getUserByUsername(username) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, password_hash, role, created_at
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

    if (fields.length === 0) return;

    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  getAllUsers() {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, role, created_at
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
        u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(sessionId, Date.now()) || null;
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
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(id) || null;

    if (!post) return null;
    const mediaMap = this.getPostMediaMap([post.id]);
    const media = mediaMap.get(post.id) || [];
    const fallback = post.media_url ? [{ url: post.media_url, type: "image", sortOrder: 0 }] : [];
    return {
      ...post,
      media: media.length ? media : fallback,
    };
  },

  getFeed(userId, limit = 50, cursor = null) {
    let query = `
      SELECT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE (p.user_id = ? OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))
    `;

    if (cursor) {
      query += ` AND p.created_at < ? ORDER BY p.created_at DESC LIMIT ?`;
      const rows = db.prepare(query).all(userId, userId, cursor, limit + 1);
      return this.attachMedia(rows);
    }

    query += ` ORDER BY p.created_at DESC LIMIT ?`;
    const rows = db.prepare(query).all(userId, userId, limit + 1);
    return this.attachMedia(rows);
  },

  deletePost(id) {
    db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  },

  getUserPosts(userId, limit = 50) {
    const rows = db.prepare(`
      SELECT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(userId, limit);
    return this.attachMedia(rows);
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

  // LIKE
  likePost(userId, postId) {
    db.prepare(`INSERT OR IGNORE INTO likes (user_id, post_id) VALUES (?, ?)`).run(userId, postId);
  },

  unlikePost(userId, postId) {
    db.prepare("DELETE FROM likes WHERE user_id = ? AND post_id = ?").run(userId, postId);
  },

  isLiked(userId, postId) {
    return !!db.prepare(`SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?`).get(userId, postId);
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
      WHERE c.id = ?
    `).get(id) || null;
  },

  getComments(postId) {
    return db.prepare(`
      SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
             u.username, u.display_name, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(postId);
  },

  deleteComment(id) {
    db.prepare("DELETE FROM comments WHERE id = ?").run(id);
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
             ub.username as used_by_username
      FROM invites i
      LEFT JOIN users u ON i.invited_by = u.id
      LEFT JOIN users ub ON i.used_by = ub.id
      ORDER BY i.created_at DESC
    `).all();
  },

  markInviteUsed(id, userId) {
    db.prepare("UPDATE invites SET used = 1, used_by = ? WHERE id = ?").run(userId, id);
  },

  // SEARCH
  searchUsers(query, limit = 20) {
    const pattern = `%${query}%`;
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar
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
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.content LIKE ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(pattern, limit);
    return this.attachMedia(rows);
  },

  // STATS
  getStats() {
    const users = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const posts = db.prepare("SELECT COUNT(*) as count FROM posts").get().count;
    const invites = db.prepare("SELECT COUNT(*) as count FROM invites WHERE used = 0").get().count;
    return { users, posts, invites };
  },
};

export default db;
