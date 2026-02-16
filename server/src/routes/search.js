import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";
import { searchRateLimit } from "../middleware/rateLimit.js";
import { sanitizeSearchQuery } from "../lib/sanitize.js";

export const searchRouter = new Hono();

searchRouter.use("*", searchRateLimit);

searchRouter.get("/users", ensureSession, async (c) => {
  const q = sanitizeSearchQuery(c.req.query("q"));
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

searchRouter.get("/posts", ensureSession, async (c) => {
  const q = sanitizeSearchQuery(c.req.query("q"));
  if (!q) return c.json({ error: "Query required" }, 400);

  const currentUser = c.get("user");
  const posts = dbUtils.searchPosts(q, 50, currentUser.id);
  const reactionsMap = dbUtils.getUserReactionsMap(currentUser.id, posts.map(p => p.id));

  return c.json(posts.map(p => ({
    id: String(p.id),
    userId: String(p.user_id),
    content: p.content,
    media: p.media || [],
    createdAt: p.created_at,
    reactions: p.reactions || {},
    userReaction: reactionsMap.get(p.id) ?? null,
    comments: p.comments,
    author: {
      username: p.username,
      displayName: p.display_name,
      avatar: p.avatar || undefined,
    },
  })));
});
