import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";

export const feedRouter = new Hono();

function formatPost(post, userReaction = null, poll = null, userVote = null) {
  return {
    id: String(post.id),
    userId: String(post.user_id),
    content: post.content,
    media: post.media || [],
    createdAt: post.created_at,
    reactions: post.reactions || {},
    userReaction,
    comments: post.comments,
    poll: poll ? {
      id: String(poll.id),
      question: poll.question,
      userVote: userVote ? String(userVote) : null,
      totalVotes: poll.totalVotes,
      options: poll.options.map(opt => ({
        id: String(opt.id),
        optionText: opt.option_text,
        voteCount: opt.vote_count,
        sortOrder: opt.sort_order,
      })),
    } : null,
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

  const formatted = results.map(p => {
    const poll = dbUtils.getPoll(p.id);
    const userVote = poll ? dbUtils.getUserPollVote(currentUser.id, poll.id) : null;
    return formatPost(p, userReactions.get(p.id) || null, poll, userVote);
  });

  return c.json({
    posts: formatted,
    nextCursor: hasMore ? results[results.length - 1].created_at : undefined,
  });
});
