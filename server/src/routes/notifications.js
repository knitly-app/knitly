import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";

export const notificationsRouter = new Hono();

notificationsRouter.use("/*", ensureSession);

function formatNotification(n) {
  return {
    id: String(n.id),
    type: n.type,
    fromUserId: String(n.from_user_id),
    fromUsername: n.from_username,
    fromDisplayName: n.from_display_name,
    fromAvatar: n.from_avatar || undefined,
    postId: n.post_id ? String(n.post_id) : undefined,
    read: Boolean(n.read),
    createdAt: n.created_at,
  };
}

notificationsRouter.get("/", async (c) => {
  const currentUser = c.get("user");
  const notifications = dbUtils.getNotifications(currentUser.id, 50);
  return c.json(notifications.map(formatNotification));
});

notificationsRouter.patch("/:id/read", async (c) => {
  const currentUser = c.get("user");
  const id = parseInt(c.req.param("id"));
  dbUtils.markNotificationRead(id, currentUser.id);
  return c.json({ success: true });
});

notificationsRouter.post("/read-all", async (c) => {
  const currentUser = c.get("user");
  dbUtils.markAllNotificationsRead(currentUser.id);
  return c.json({ success: true });
});

notificationsRouter.delete("/", async (c) => {
  const currentUser = c.get("user");
  dbUtils.clearAllNotifications(currentUser.id);
  return c.json({ success: true });
});
