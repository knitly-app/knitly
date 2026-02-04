import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";

export const feedRouter = new Hono();

function formatPost(post, userReaction = null) {
  return {
    id: String(post.id),
    userId: String(post.user_id),
    content: post.content,
    media: post.media || [],
    createdAt: post.created_at,
    reactions: post.reactions || {},
    userReaction,
    comments: post.comments,
    author: {
      username: post.username,
      displayName: post.display_name,
      avatar: post.avatar || undefined,
    },
  };
}

feedRouter.get("/", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const cursor = c.req.query("cursor");
  const circleId = c.req.query("circleId");

  const posts = dbUtils.getFeed(51, cursor, currentUser.id, circleId ? parseInt(circleId) : null);
  const hasMore = posts.length > 50;
  const results = hasMore ? posts.slice(0, 50) : posts;

  const postIds = results.map(p => p.id);
  const userReactions = dbUtils.getUserReactionsMap(currentUser.id, postIds);

  const formatted = results.map(p => formatPost(p, userReactions.get(p.id) || null));

  return c.json({
    posts: formatted,
    nextCursor: hasMore ? results[results.length - 1].created_at : undefined,
  });
});
