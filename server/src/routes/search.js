import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession, optionalAuth } from "../middleware/auth.js";

export const searchRouter = new Hono();

searchRouter.get("/users", ensureSession, async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "Query required" }, 400);

  const users = dbUtils.searchUsers(q, 20);
  return c.json(users.map(u => ({
    id: String(u.id),
    username: u.username,
    displayName: u.display_name,
    avatar: u.avatar || undefined,
    bio: u.bio || undefined,
  })));
});

searchRouter.get("/posts", optionalAuth, async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "Query required" }, 400);

  const currentUser = c.get("user");
  const posts = dbUtils.searchPosts(q, 50);

  return c.json(posts.map(p => ({
    id: String(p.id),
    userId: String(p.user_id),
    content: p.content,
    media: p.media || [],
    createdAt: p.created_at,
    likes: p.likes,
    comments: p.comments,
    liked: currentUser ? dbUtils.isLiked(currentUser.id, p.id) : false,
  })));
});
