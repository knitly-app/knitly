import { db } from "./core.js";

export const userQueries = {
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

  getAdminCount() {
    return db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND disabled_at IS NULL").get().count;
  },

  getPasswordHash(userId) {
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId);
    return row?.password_hash || null;
  },

  updatePasswordHash(userId, passwordHash) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
  },

  updateUserEmail(userId, newEmail) {
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(newEmail, userId);
  },

  getBots() {
    return db.prepare(`
      SELECT u.id, u.username, u.display_name, u.bio, u.avatar, u.role, u.disabled_at, u.created_at,
             (SELECT MAX(ak.last_used_at) FROM api_keys ak WHERE ak.user_id = u.id AND ak.revoked_at IS NULL) as last_active
      FROM users u WHERE u.role = 'bot' ORDER BY u.created_at DESC
    `).all();
  },
};
