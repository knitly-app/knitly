import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession, requireRole } from "../middleware/auth.js";

export const adminRouter = new Hono();

adminRouter.use("/*", ensureSession, requireRole("admin"));

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

adminRouter.get("/users", async (c) => {
  const users = dbUtils.getAllUsers();
  return c.json(users.map(formatUser));
});

adminRouter.post("/users/:id/disable", async (c) => {
  const currentUser = c.get("user");
  const userId = parseInt(c.req.param("id"), 10);

  if (!Number.isFinite(userId)) return c.json({ error: "Invalid user id" }, 400);
  if (userId === currentUser.id) return c.json({ error: "Cannot disable yourself" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Cannot disable owner" }, 400);

  const disabledAt = dbUtils.disableUser(userId);
  dbUtils.deleteSessionsByUser(userId);
  return c.json({ id: String(userId), disabledAt });
});

adminRouter.post("/users/:id/enable", async (c) => {
  const userId = parseInt(c.req.param("id"), 10);

  if (!Number.isFinite(userId)) return c.json({ error: "Invalid user id" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);

  dbUtils.enableUser(userId);
  return c.json({ id: String(userId), disabledAt: null });
});

adminRouter.post("/users/:id/promote", async (c) => {
  const userId = parseInt(c.req.param("id"), 10);

  if (!Number.isFinite(userId)) return c.json({ error: "Invalid user id" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Owner cannot be promoted" }, 400);

  dbUtils.updateUserRole(userId, "moderator");
  return c.json({ id: String(userId), role: "moderator" });
});

adminRouter.post("/users/:id/demote", async (c) => {
  const userId = parseInt(c.req.param("id"), 10);

  if (!Number.isFinite(userId)) return c.json({ error: "Invalid user id" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Owner cannot be demoted" }, 400);

  dbUtils.updateUserRole(userId, "member");
  return c.json({ id: String(userId), role: "member" });
});

adminRouter.post("/users/:id/transfer", async (c) => {
  const currentUser = c.get("user");
  const userId = parseInt(c.req.param("id"), 10);

  if (!Number.isFinite(userId)) return c.json({ error: "Invalid user id" }, 400);
  if (userId === currentUser.id) return c.json({ error: "Already owner" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.disabled_at) return c.json({ error: "Cannot transfer to disabled user" }, 400);

  dbUtils.transferOwnership(currentUser.id, userId);
  return c.json({ id: String(userId), role: "admin" });
});

adminRouter.delete("/users/:id", async (c) => {
  const currentUser = c.get("user");
  const userId = parseInt(c.req.param("id"), 10);

  if (!Number.isFinite(userId)) return c.json({ error: "Invalid user id" }, 400);
  if (userId === currentUser.id) return c.json({ error: "Cannot remove yourself" }, 400);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "User not found" }, 404);
  if (user.role === "admin") return c.json({ error: "Cannot remove owner" }, 400);

  dbUtils.deleteUser(userId);
  dbUtils.deleteSessionsByUser(userId);
  return c.json({ success: true });
});

adminRouter.get("/stats", async (c) => {
  const stats = dbUtils.getStats();
  return c.json(stats);
});

adminRouter.get("/content", async (c) => {
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

adminRouter.post("/content/:id/delete", async (c) => {
  const itemId = parseInt(c.req.param("id"), 10);
  if (!Number.isFinite(itemId)) return c.json({ error: "Invalid id" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const type = body?.type;

  if (type === "post") {
    const post = dbUtils.getPost(itemId);
    if (!post) return c.json({ error: "Not found" }, 404);
    dbUtils.deletePost(itemId);
    return c.json({ success: true, type, id: String(itemId) });
  }

  if (type === "comment") {
    const comment = dbUtils.getComment(itemId);
    if (!comment) return c.json({ error: "Not found" }, 404);
    dbUtils.deleteComment(itemId);
    return c.json({ success: true, type, id: String(itemId), postId: String(comment.post_id) });
  }

  return c.json({ error: "Invalid type" }, 400);
});
