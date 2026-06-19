import { db } from "./core.js";

export const auditQueries = {
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
