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
    createdAt: user.created_at,
  };
}

adminRouter.get("/users", async (c) => {
  const users = dbUtils.getAllUsers();
  return c.json(users.map(formatUser));
});

adminRouter.get("/stats", async (c) => {
  const stats = dbUtils.getStats();
  return c.json(stats);
});
