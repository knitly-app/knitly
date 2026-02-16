import crypto from "crypto";
import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { generateRandomToken } from "../lib/security.js";
import { ensureSession, requireRole } from "../middleware/auth.js";

export const adminRouter = new Hono();

adminRouter.use("/*", ensureSession);

function formatUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    role: user.role,
    disabledAt: user.disabled_at || null,
    createdAt: user.created_at,
  };
}

function parseUserId(c) {
  const userId = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(userId)) return { error: "Invalid user id" };
  return { userId };
}

function maskToken(token) {
  return token.length <= 8 ? token : `...${token.slice(-8)}`;
}

function sanitizeAuditMetadata(actionType, rawMetadata) {
  if (!rawMetadata || typeof rawMetadata !== "object") return rawMetadata;

  if ((actionType === "INVITE_CREATED" || actionType === "INVITE_REVOKED") && typeof rawMetadata.token === "string") {
    const { token, ...rest } = rawMetadata;
    return {
      ...rest,
      tokenSuffix: typeof rawMetadata.tokenSuffix === "string" ? rawMetadata.tokenSuffix : maskToken(token),
    };
  }

  return rawMetadata;
}

adminRouter.get("/users", requireRole("admin", "moderator"), (c) => {
  const users = dbUtils.getAllUsers();
  return c.json(users.map(formatUser));
});

adminRouter.post("/users/:id/disable", requireRole("admin", "moderator"), (c) => {
  const currentUser = c.get("user");
  const { userId, error } = parseUserId(c);
  if (error) return c.json({ error }, 400);

  if (userId === currentUser.id) return c.json({ error: "Cannot disable yourself" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Cannot disable owner" }, 400);

  const disabledAt = dbUtils.disableUser(userId);
  dbUtils.deleteSessionsByUser(userId);
  dbUtils.createAuditEntry(currentUser.id, "USER_DISABLED", "user", userId);
  return c.json({ id: String(userId), disabledAt });
});

adminRouter.post("/users/:id/enable", requireRole("admin", "moderator"), (c) => {
  const currentUser = c.get("user");
  const { userId, error } = parseUserId(c);
  if (error) return c.json({ error }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  dbUtils.enableUser(userId);
  dbUtils.createAuditEntry(currentUser.id, "USER_ENABLED", "user", userId);
  return c.json({ id: String(userId), disabledAt: null });
});

adminRouter.post("/users/:id/promote", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const { userId, error } = parseUserId(c);
  if (error) return c.json({ error }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Owner cannot be promoted" }, 400);

  dbUtils.updateUserRole(userId, "moderator");
  dbUtils.createAuditEntry(currentUser.id, "USER_PROMOTED_MODERATOR", "user", userId);
  return c.json({ id: String(userId), role: "moderator" });
});

adminRouter.post("/users/:id/demote", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const { userId, error } = parseUserId(c);
  if (error) return c.json({ error }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Owner cannot be demoted" }, 400);

  dbUtils.updateUserRole(userId, "member");
  dbUtils.createAuditEntry(currentUser.id, "USER_DEMOTED_MODERATOR", "user", userId);
  return c.json({ id: String(userId), role: "member" });
});

adminRouter.post("/users/:id/transfer", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const { userId, error } = parseUserId(c);
  if (error) return c.json({ error }, 400);

  if (userId === currentUser.id) return c.json({ error: "Already owner" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.disabled_at) return c.json({ error: "Cannot transfer to disabled user" }, 400);

  dbUtils.transferOwnership(currentUser.id, userId);
  dbUtils.createAuditEntry(currentUser.id, "OWNERSHIP_TRANSFERRED", "user", userId);
  return c.json({ id: String(userId), role: "admin" });
});

adminRouter.delete("/users/:id", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const { userId, error } = parseUserId(c);
  if (error) return c.json({ error }, 400);

  if (userId === currentUser.id) return c.json({ error: "Cannot remove yourself" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Cannot remove owner" }, 400);

  dbUtils.createAuditEntry(currentUser.id, "USER_REMOVED", "user", userId);
  dbUtils.deleteUser(userId);
  return c.json({ success: true });
});

adminRouter.get("/bots", requireRole("admin"), (c) => {
  const bots = dbUtils.getBots();
  return c.json(bots.map(bot => ({
    id: String(bot.id),
    username: bot.username,
    displayName: bot.display_name,
    avatar: bot.avatar || undefined,
    bio: bot.bio || undefined,
    role: bot.role,
    disabledAt: bot.disabled_at || null,
    createdAt: bot.created_at,
    lastActive: bot.last_active || null,
    keys: dbUtils.getApiKeysByUser(bot.id).map(k => ({
      id: String(k.id),
      label: k.label,
      lastUsedAt: k.last_used_at || null,
      revokedAt: k.revoked_at || null,
      createdAt: k.created_at,
    })),
  })));
});

adminRouter.post("/bots", requireRole("admin"), async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();

  const username = body.username?.trim();
  const displayName = body.displayName?.trim();
  const bio = body.bio?.trim() || '';

  if (!username || !displayName) {
    return c.json({ error: "Username and display name required" }, 400);
  }

  if (!/^[a-zA-Z0-9_]{2,30}$/.test(username)) {
    return c.json({ error: "Username must be 2-30 alphanumeric characters" }, 400);
  }

  if (dbUtils.getUserByUsername(username)) {
    return c.json({ error: "Username already taken" }, 400);
  }

  const botEmail = `${username}@bot.knitly.local`;
  const userId = dbUtils.createUser(botEmail, username, displayName, null, "bot");

  if (bio) {
    dbUtils.updateUser(userId, { bio });
  }

  const rawKey = `knitly_${generateRandomToken(32)}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  dbUtils.createApiKey(userId, keyHash, "default");

  dbUtils.createAuditEntry(currentUser.id, "BOT_CREATED", "user", userId);

  return c.json({
    id: String(userId),
    username,
    displayName,
    bio,
    apiKey: rawKey,
  }, 201);
});

adminRouter.post("/bots/:id/regenerate-key", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const botId = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(botId)) return c.json({ error: "Invalid bot id" }, 400);

  const bot = dbUtils.getUserById(botId);
  if (!bot || bot.role !== 'bot') return c.json({ error: "Bot not found" }, 404);

  dbUtils.revokeApiKeysByUser(botId);

  const rawKey = `knitly_${generateRandomToken(32)}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  dbUtils.createApiKey(botId, keyHash, "default");

  dbUtils.createAuditEntry(currentUser.id, "BOT_KEY_REGENERATED", "user", botId);

  return c.json({ apiKey: rawKey });
});

adminRouter.post("/bots/:id/revoke-key", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const botId = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(botId)) return c.json({ error: "Invalid bot id" }, 400);

  const bot = dbUtils.getUserById(botId);
  if (!bot || bot.role !== 'bot') return c.json({ error: "Bot not found" }, 404);

  dbUtils.revokeApiKeysByUser(botId);
  dbUtils.createAuditEntry(currentUser.id, "BOT_KEY_REVOKED", "user", botId);

  return c.json({ success: true });
});

adminRouter.delete("/bots/:id", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const botId = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(botId)) return c.json({ error: "Invalid bot id" }, 400);

  const bot = dbUtils.getUserById(botId);
  if (!bot || bot.role !== 'bot') return c.json({ error: "Bot not found" }, 404);

  dbUtils.createAuditEntry(currentUser.id, "BOT_DELETED", "user", botId);
  dbUtils.deleteApiKeysByUser(botId);
  dbUtils.deleteUser(botId);

  return c.json({ success: true });
});

adminRouter.get("/stats", requireRole("admin"), (c) => {
  const stats = dbUtils.getStats();
  return c.json(stats);
});

adminRouter.get("/content", requireRole("admin", "moderator"), (c) => {
  const limitParam = c.req.query("limit");
  const cursor = c.req.query("cursor");
  const query = c.req.query("q") || "";
  const limit = Math.min(parseInt(limitParam || "30", 10) || 30, 200);
  const items = dbUtils.getModerationFeed({ limit, cursor, query });
  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const lastItem = results[results.length - 1];
  const nextCursor = hasMore && lastItem ? `${lastItem.created_at}|${lastItem.id}` : undefined;

  return c.json({
    items: results.map(item => ({
      type: item.type,
      id: String(item.id),
      content: item.content,
      createdAt: item.created_at,
      author: {
        id: String(item.user_id),
        username: item.username,
        displayName: item.display_name,
        avatar: item.avatar || undefined,
      },
      postId: item.post_id ? String(item.post_id) : undefined,
      postContent: item.post_content || undefined,
      postAuthor: item.post_author_username ? {
        username: item.post_author_username,
        displayName: item.post_author_display_name,
      } : undefined,
      commentsCount: item.comments_count ?? undefined,
      mediaCount: item.media_count ?? undefined,
    })),
    nextCursor,
  });
});

adminRouter.post("/content/:id/delete", requireRole("admin", "moderator"), async (c) => {
  const currentUser = c.get("user");
  const itemId = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(itemId)) return c.json({ error: "Invalid id" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const type = body?.type;

  if (type === "post") {
    const post = dbUtils.getPost(itemId);
    if (!post) return c.json({ error: "Not found" }, 404);
    dbUtils.deletePost(itemId);
    dbUtils.createAuditEntry(currentUser.id, "CONTENT_DELETED", type, itemId, { type });
    return c.json({ success: true, type, id: String(itemId) });
  }

  if (type === "comment") {
    const comment = dbUtils.getComment(itemId);
    if (!comment) return c.json({ error: "Not found" }, 404);
    dbUtils.deleteComment(itemId);
    dbUtils.createAuditEntry(currentUser.id, "CONTENT_DELETED", type, itemId, { type });
    return c.json({ success: true, type, id: String(itemId), postId: String(comment.post_id) });
  }

  return c.json({ error: "Invalid type" }, 400);
});

adminRouter.get("/audit", requireRole("admin", "moderator"), (c) => {
  const limitParam = c.req.query("limit");
  const cursor = c.req.query("cursor");
  const limit = Math.min(parseInt(limitParam || "50", 10) || 50, 200);

  const items = dbUtils.getAuditLog({ limit, cursor });
  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const lastItem = results[results.length - 1];
  const nextCursor = hasMore && lastItem ? `${lastItem.created_at}|${lastItem.id}` : undefined;

  return c.json({
    items: results.map(item => ({
      id: String(item.id),
      actionType: item.action_type,
      targetType: item.target_type,
      targetId: item.target_id ? String(item.target_id) : null,
      metadata: item.metadata_json ? sanitizeAuditMetadata(item.action_type, JSON.parse(item.metadata_json)) : null,
      createdAt: item.created_at,
      actor: {
        id: String(item.actor_id),
        username: item.actor_username,
        displayName: item.actor_display_name,
      },
    })),
    nextCursor,
  });
});

adminRouter.post("/users/:id/revoke-sessions", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const { userId, error } = parseUserId(c);
  if (error) return c.json({ error }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  dbUtils.deleteSessionsByUser(userId);
  dbUtils.createAuditEntry(currentUser.id, "SESSIONS_REVOKED", "user", userId);

  return c.json({ success: true, id: String(userId) });
});

adminRouter.post("/users/:id/reset-password", requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const { userId, error } = parseUserId(c);
  if (error) return c.json({ error }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Cannot reset owner password" }, 400);

  const token = generateRandomToken(32);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  dbUtils.createResetToken(userId, tokenHash, expiresAt);
  dbUtils.createAuditEntry(currentUser.id, "PASSWORD_RESET_GENERATED", "user", userId);

  return c.json({ token, expiresAt });
});
