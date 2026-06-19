import { db } from "./core.js";

export const moderationQueries = {
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
};
