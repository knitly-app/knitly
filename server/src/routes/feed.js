import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";
import { formatPost } from "../lib/formatters.js";

export const feedRouter = new Hono();

feedRouter.get("/", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const cursor = c.req.query("cursor");
  const circleId = c.req.query("circleId");
  const since = c.req.query("since");

  const sinceId = since ? parseInt(since) : null;
  const posts = dbUtils.getFeed(51, sinceId ? null : cursor, currentUser.id, circleId ? parseInt(circleId) : null, sinceId);
  const hasMore = posts.length > 50;
  const results = hasMore ? posts.slice(0, 50) : posts;

  const postIds = results.map(p => p.id);
  const userReactions = dbUtils.getUserReactionsMap(currentUser.id, postIds);

  const formatted = results.map(p => {
    const poll = dbUtils.getPoll(p.id);
    const userVote = poll ? dbUtils.getUserPollVote(currentUser.id, poll.id) : null;
    return formatPost(p, { userReaction: userReactions.get(p.id) || null, poll, userVote });
  });

  return c.json({
    posts: formatted,
    nextCursor: hasMore ? results[results.length - 1].created_at : undefined,
  });
});
