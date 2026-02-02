import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";

export const feedRouter = new Hono();

function formatPost(post, liked = false) {
  return {
    id: String(post.id),
    userId: String(post.user_id),
    content: post.content,
    media: post.media || [],
    createdAt: post.created_at,
    likes: post.likes,
    comments: post.comments,
    liked,
  };
}

feedRouter.get("/", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const cursor = c.req.query("cursor");

  const posts = dbUtils.getFeed(currentUser.id, 50, cursor);
  const hasMore = posts.length > 50;
  const results = hasMore ? posts.slice(0, 50) : posts;

  const formatted = results.map(p => formatPost(p, dbUtils.isLiked(currentUser.id, p.id)));

  return c.json({
    posts: formatted,
    nextCursor: hasMore ? results[results.length - 1].created_at : undefined,
  });
});
