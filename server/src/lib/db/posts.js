import { db } from "./core.js";

export const postQueries = {
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

  isMediaUrlReferenced(urlFragment) {
    const row = db.prepare(
      `SELECT 1 FROM post_media WHERE url LIKE '%' || ? || '%' LIMIT 1`
    ).get(urlFragment);
    return !!row;
  },
};
