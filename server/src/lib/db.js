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
    thumbnail_url TEXT,
    width INTEGER,
    height INTEGER,
    duration REAL,
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

  CREATE TABLE IF NOT EXISTS circles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'blue',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS circle_members (
    circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (circle_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS post_circles (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, circle_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
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
  CREATE INDEX IF NOT EXISTS idx_circles_user_id ON circles(user_id);
  CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id);
  CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_post_circles_post ON post_circles(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_circles_circle ON post_circles(circle_id);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_presence (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_seen TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (poll_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT '',
    last_used_at TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_change_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_polls_post_id ON polls(post_id);
  CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
  CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
  CREATE INDEX IF NOT EXISTS idx_email_change_tokens_user ON email_change_tokens(user_id);
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
addColumnIfMissing(`ALTER TABLE users ADD COLUMN header TEXT DEFAULT ''`);
addColumnIfMissing(`ALTER TABLE post_media ADD COLUMN thumbnail_url TEXT`);
addColumnIfMissing(`ALTER TABLE post_media ADD COLUMN duration REAL`);

// Create indexes that depend on migrated columns
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_created ON posts(deleted_at, created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
  ANALYZE;
`);

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export const dbUtils = {
  // USER
  getUserById(id) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, header, location, website, role, disabled_at, created_at
      FROM users WHERE id = ?
    `).get(id) || null;
  },

  getUserByEmail(email) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, header, location, website, password_hash, role, disabled_at, created_at
      FROM users WHERE email = ?
    `).get(email) || null;
  },

  getUserByUsername(username) {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, header, location, website, password_hash, role, disabled_at, created_at
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
    if (updates.header !== undefined) {
      fields.push("header = ?");
      values.push(updates.header);
    }

    if (fields.length === 0) return;

    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  getAllUsers() {
    return db.prepare(`
      SELECT id, email, username, display_name, bio, avatar, header, location, website, role, disabled_at, created_at
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
        u.username, u.display_name, u.avatar, u.role,
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

  getFeed(limit = 50, cursor = null, viewerId = null, circleId = null, since = null) {
    let query = `
      SELECT DISTINCT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar, u.role,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_circles pc ON p.id = pc.post_id
      LEFT JOIN circle_members cm ON pc.circle_id = cm.circle_id AND cm.user_id = ?
      WHERE p.deleted_at IS NULL
        AND (
          pc.post_id IS NULL
          OR p.user_id = ?
          OR cm.user_id IS NOT NULL
        )
    `;
    const params = [viewerId, viewerId];

    if (circleId) {
      query += ` AND pc.circle_id = ?`;
      params.push(circleId);
    }

    if (since) {
      query += ` AND p.id > ?`;
      params.push(since);
    } else if (cursor) {
      query += ` AND p.created_at < ?`;
      params.push(cursor);
    }

    query += ` ORDER BY p.created_at DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = db.prepare(query).all(...params);
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

  getUserPosts(userId, limit = 50, viewerId = null, mediaOnly = false) {
    const mediaFilter = mediaOnly ? " AND p.id IN (SELECT post_id FROM post_media)" : "";

    if (viewerId === userId) {
      const rows = db.prepare(`
        SELECT
          p.id, p.user_id, p.content, p.media_url, p.created_at,
          u.username, u.display_name, u.avatar, u.role,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ? AND p.deleted_at IS NULL${mediaFilter}
        ORDER BY p.created_at DESC
        LIMIT ?
      `).all(userId, limit);
      return this.attachMediaAndReactions(rows);
    }

    const rows = db.prepare(`
      SELECT DISTINCT
        p.id, p.user_id, p.content, p.media_url, p.created_at,
        u.username, u.display_name, u.avatar, u.role,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND deleted_at IS NULL) as comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_circles pc ON p.id = pc.post_id
      LEFT JOIN circle_members cm ON pc.circle_id = cm.circle_id AND cm.user_id = ?
      WHERE p.user_id = ? AND p.deleted_at IS NULL${mediaFilter}
        AND (
          pc.post_id IS NULL
          OR cm.user_id IS NOT NULL
        )
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(viewerId, userId, limit);
    return this.attachMediaAndReactions(rows);
  },

  addPostMedia(postId, media = []) {
    if (!Array.isArray(media) || media.length === 0) return;

    const insert = db.prepare(`
      INSERT INTO post_media (post_id, url, thumbnail_url, width, height, duration, type, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((items) => {
      items.forEach((item, index) => {
        insert.run(
          postId,
          item.url,
          item.thumbnailUrl ?? null,
          item.width ?? null,
          item.height ?? null,
          item.duration ?? null,
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
      SELECT id, post_id, url, thumbnail_url, width, height, duration, type, sort_order
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
        thumbnailUrl: row.thumbnail_url,
        width: row.width,
        height: row.height,
        duration: row.duration,
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

  needsSetup() {
    const result = db.prepare("SELECT COUNT(*) as count FROM users").get();
    return result.count === 0;
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

  // CIRCLE MANAGEMENT
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

  // CIRCLE MEMBER MANAGEMENT
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

  // POST-CIRCLE LINKING
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

  // VISIBILITY
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

  // SETTINGS
  getSetting(key) {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? row.value : null;
  },

  setSetting(key, value) {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  },

  getAllSettings() {
    const appName = this.getSetting("appName") || "Knitly";
    const logoIcon = this.getSetting("logoIcon") || "Zap";
    return { appName, logoIcon };
  },

  setSettings(updates) {
    const tx = db.transaction((data) => {
      if (data.appName !== undefined) this.setSetting("appName", data.appName);
      if (data.logoIcon !== undefined) this.setSetting("logoIcon", data.logoIcon);
    });
    tx(updates);
  },

  // CHAT
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

  // POLLS
  createPoll(postId, question, options) {
    const tx = db.transaction((pId, q, opts) => {
      const pollResult = db.prepare(`
        INSERT INTO polls (post_id, question) VALUES (?, ?)
      `).run(pId, q);
      const pollId = pollResult.lastInsertRowid;

      const insertOption = db.prepare(`
        INSERT INTO poll_options (poll_id, option_text, sort_order) VALUES (?, ?, ?)
      `);
      opts.forEach((text, index) => {
        insertOption.run(pollId, text, index);
      });

      return pollId;
    });
    return tx(postId, question, options);
  },

  getPoll(postId) {
    const poll = db.prepare(`
      SELECT id, post_id, question, created_at
      FROM polls WHERE post_id = ?
    `).get(postId);
    if (!poll) return null;

    const options = db.prepare(`
      SELECT po.id, po.option_text, po.sort_order,
             COUNT(pv.user_id) as vote_count
      FROM poll_options po
      LEFT JOIN poll_votes pv ON po.id = pv.option_id
      WHERE po.poll_id = ?
      GROUP BY po.id
      ORDER BY po.sort_order ASC
    `).all(poll.id);

    const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);

    return {
      id: poll.id,
      postId: poll.post_id,
      question: poll.question,
      createdAt: poll.created_at,
      totalVotes,
      options,
    };
  },

  getUserPollVote(userId, pollId) {
    const row = db.prepare(`
      SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?
    `).get(pollId, userId);
    return row ? row.option_id : null;
  },

  votePoll(userId, pollId, optionId) {
    const option = db.prepare(`
      SELECT id FROM poll_options WHERE id = ? AND poll_id = ?
    `).get(optionId, pollId);
    if (!option) return { error: "Invalid option" };

    const existing = db.prepare(`
      SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ?
    `).get(pollId, userId);
    if (existing) return { error: "Already voted" };

    db.prepare(`
      INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)
    `).run(pollId, optionId, userId);

    return { success: true };
  },

  // PASSWORD RESET
  createResetToken(userId, tokenHash, expiresAt) {
    const tx = db.transaction((uid, hash, exp) => {
      db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(uid);
      db.prepare(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)
      `).run(uid, hash, exp);
    });
    tx(userId, tokenHash, expiresAt);
  },

  getResetToken(tokenHash) {
    return db.prepare(`
      SELECT t.id, t.user_id, t.expires_at,
             u.email, u.username, u.display_name, u.disabled_at
      FROM password_reset_tokens t
      JOIN users u ON t.user_id = u.id
      WHERE t.token_hash = ?
    `).get(tokenHash) || null;
  },

  deleteResetToken(tokenHash) {
    db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(tokenHash);
  },

  deleteResetTokensByUser(userId) {
    db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(userId);
  },

  updatePasswordHash(userId, passwordHash) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
  },

  createEmailChangeToken(userId, newEmail, tokenHash, expiresAt) {
    const tx = db.transaction((uid, email, hash, exp) => {
      db.prepare("DELETE FROM email_change_tokens WHERE user_id = ?").run(uid);
      db.prepare(`
        INSERT INTO email_change_tokens (user_id, new_email, token_hash, expires_at) VALUES (?, ?, ?, ?)
      `).run(uid, email, hash, exp);
    });
    tx(userId, newEmail, tokenHash, expiresAt);
  },

  getEmailChangeToken(tokenHash) {
    return db.prepare(`
      SELECT t.id, t.user_id, t.new_email, t.expires_at,
             u.email, u.username, u.display_name, u.disabled_at
      FROM email_change_tokens t
      JOIN users u ON t.user_id = u.id
      WHERE t.token_hash = ?
    `).get(tokenHash) || null;
  },

  deleteEmailChangeToken(tokenHash) {
    db.prepare("DELETE FROM email_change_tokens WHERE token_hash = ?").run(tokenHash);
  },

  deleteEmailChangeTokensByUser(userId) {
    db.prepare("DELETE FROM email_change_tokens WHERE user_id = ?").run(userId);
  },

  updateUserEmail(userId, newEmail) {
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(newEmail, userId);
  },

  getAdminCount() {
    return db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND disabled_at IS NULL").get().count;
  },

  getPasswordHash(userId) {
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId);
    return row?.password_hash || null;
  },

  createApiKey(userId, keyHash, label = '') {
    const result = db.prepare(`
      INSERT INTO api_keys (user_id, key_hash, label) VALUES (?, ?, ?)
    `).run(userId, keyHash, label);
    return result.lastInsertRowid;
  },

  getApiKeyByHash(keyHash) {
    return db.prepare(`
      SELECT ak.id, ak.user_id, ak.label, ak.last_used_at, ak.revoked_at, ak.created_at,
             u.email, u.username, u.display_name, u.bio, u.avatar, u.role, u.disabled_at
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = ? AND ak.revoked_at IS NULL
    `).get(keyHash) || null;
  },

  updateApiKeyLastUsed(keyId) {
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(keyId);
  },

  getApiKeysByUser(userId) {
    return db.prepare(`
      SELECT id, user_id, label, last_used_at, revoked_at, created_at
      FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);
  },

  revokeApiKey(keyId) {
    db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?").run(keyId);
  },

  revokeApiKeysByUser(userId) {
    db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").run(userId);
  },

  deleteApiKeysByUser(userId) {
    db.prepare("DELETE FROM api_keys WHERE user_id = ?").run(userId);
  },

  getBots() {
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.bio, u.avatar, u.role, u.disabled_at, u.created_at,
             (SELECT MAX(ak.last_used_at) FROM api_keys ak WHERE ak.user_id = u.id AND ak.revoked_at IS NULL) as last_active
      FROM users u WHERE u.role = 'bot' ORDER BY u.created_at DESC
    `).all();
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

  isMediaUrlReferenced(urlFragment) {
    const row = db.prepare(
      `SELECT 1 FROM post_media WHERE url LIKE '%' || ? || '%' LIMIT 1`
    ).get(urlFragment);
    return !!row;
  },
};

export default db;
