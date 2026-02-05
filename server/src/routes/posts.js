import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";
import { sanitizeText } from "../lib/sanitize.js";
import { deleteObject, extractKeyFromUrl } from "../lib/media.js";
import { parseMentions, resolveMentions } from "../lib/mentions.js";

export const postsRouter = new Hono();

const VALID_REACTIONS = ["love", "haha", "hugs", "celebrate"];

function formatPost(post, userReaction = null, circleIds = null, poll = null, userVote = null) {
  return {
    id: String(post.id),
    userId: String(post.user_id),
    content: post.content,
    media: post.media || [],
    createdAt: post.created_at,
    reactions: post.reactions || {},
    userReaction,
    comments: post.comments,
    circleIds: circleIds ?? dbUtils.getPostCircles(post.id).map(String),
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

postsRouter.get("/:id", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  if (!dbUtils.canUserViewPost(currentUser.id, postId)) {
    return c.json({ error: "Not found" }, 404);
  }

  const userReaction = currentUser ? dbUtils.getUserReaction(currentUser.id, postId) : null;
  const poll = dbUtils.getPoll(postId);
  const userVote = poll ? dbUtils.getUserPollVote(currentUser.id, poll.id) : null;
  return c.json(formatPost(post, userReaction, null, poll, userVote));
});

postsRouter.post("/", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();

  const content = sanitizeText(body.content);
  const rawMedia = Array.isArray(body.media) ? body.media : [];
  let media = rawMedia
    .filter((item) => item && typeof item.url === "string")
    .slice(0, 6)
    .map((item, index) => ({
      url: item.url,
      thumbnailUrl: item.thumbnailUrl || null,
      width: Number.isFinite(item.width) ? item.width : null,
      height: Number.isFinite(item.height) ? item.height : null,
      duration: Number.isFinite(item.duration) ? item.duration : null,
      type: item.type === "video" ? "video" : "image",
      sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
    }));

  if (media.length === 0 && typeof body.mediaUrl === "string") {
    media.push({
      url: body.mediaUrl,
      width: null,
      height: null,
      type: "image",
      sortOrder: 0,
    });
  }

  const pollData = body.poll;
  const hasPoll = pollData && typeof pollData.question === "string" && Array.isArray(pollData.options);

  if (hasPoll) {
    const hasVideo = media.some((m) => m.type === "video");
    if (hasVideo) {
      return c.json({ error: "Polls cannot include video" }, 400);
    }
    media = media.filter((m) => m.type === "image").slice(0, 1);

    const options = pollData.options
      .map((o) => (typeof o === "string" ? o.trim() : ""))
      .filter((o) => o.length > 0)
      .slice(0, 6);
    if (options.length < 2) {
      return c.json({ error: "Poll requires 2-6 options" }, 400);
    }
    if (!pollData.question.trim()) {
      return c.json({ error: "Poll question required" }, 400);
    }
  }

  if (!content && media.length === 0 && !hasPoll) {
    return c.json({ error: "Content or media required" }, 400);
  }

  const circleIds = Array.isArray(body.circleIds)
    ? body.circleIds.map(Number).filter(Number.isFinite)
    : [];

  const post = dbUtils.createPost(currentUser.id, content, media);

  if (circleIds.length) {
    dbUtils.setPostCircles(post.id, circleIds);
  }

  let poll = null;
  if (hasPoll) {
    const options = pollData.options
      .map((o) => (typeof o === "string" ? o.trim() : ""))
      .filter((o) => o.length > 0)
      .slice(0, 6);
    dbUtils.createPoll(post.id, pollData.question.trim(), options);
    poll = dbUtils.getPoll(post.id);
  }

  const mentionedUsernames = parseMentions(content);
  const mentionedUsers = resolveMentions(mentionedUsernames);
  for (const user of mentionedUsers) {
    if (user.id !== currentUser.id) {
      dbUtils.createNotification(user.id, "mention", currentUser.id, post.id);
    }
  }

  const userReaction = dbUtils.getUserReaction(currentUser.id, post.id);
  return c.json(formatPost(post, userReaction, null, poll, null), 201);
});

postsRouter.patch("/:id", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");
  const body = await c.req.json();

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  if (post.user_id !== currentUser.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const content = sanitizeText(body.content);
  if (!content && (!post.media || post.media.length === 0)) {
    return c.json({ error: "Content required" }, 400);
  }

  const updated = dbUtils.updatePost(postId, content);
  const userReaction = dbUtils.getUserReaction(currentUser.id, postId);
  return c.json(formatPost(updated, userReaction));
});

postsRouter.delete("/:id", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  if (post.user_id !== currentUser.id && currentUser.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const mediaToDelete = (post.media || []).flatMap((item) => {
    const keys = [];
    const mainKey = extractKeyFromUrl(item.url);
    if (mainKey) keys.push(mainKey);
    const thumbKey = extractKeyFromUrl(item.thumbnailUrl);
    if (thumbKey) keys.push(thumbKey);
    return keys;
  });

  dbUtils.deletePost(postId);

  await Promise.all(mediaToDelete.map((key) => deleteObject(key).catch(() => {})));

  return c.json({ success: true });
});

// Add or change reaction
postsRouter.post("/:id/reactions", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");
  const body = await c.req.json();

  const reactionType = body.type;
  if (!VALID_REACTIONS.includes(reactionType)) {
    return c.json({ error: "Invalid reaction type" }, 400);
  }

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  dbUtils.addReaction(currentUser.id, postId, reactionType);

  if (post.user_id !== currentUser.id) {
    dbUtils.createNotification(post.user_id, "reaction", currentUser.id, postId);
  }

  return c.json({
    success: true,
    reactions: dbUtils.getReactionCounts(postId),
    userReaction: reactionType,
  });
});

// Remove reaction
postsRouter.delete("/:id/reactions", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  dbUtils.removeReaction(currentUser.id, postId);

  return c.json({
    success: true,
    reactions: dbUtils.getReactionCounts(postId),
    userReaction: null,
  });
});

postsRouter.get("/:id/comments", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const comments = dbUtils.getComments(postId);

  return c.json(comments.map(comment => ({
    id: String(comment.id),
    postId: String(comment.post_id),
    userId: String(comment.user_id),
    username: comment.username,
    displayName: comment.display_name,
    avatar: comment.avatar || undefined,
    content: comment.content,
    createdAt: comment.created_at,
  })));
});

postsRouter.post("/:id/comments", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");
  const body = await c.req.json();

  const commentContent = sanitizeText(body.content);
  if (!commentContent) {
    return c.json({ error: "Content required" }, 400);
  }

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  const comment = dbUtils.createComment(postId, currentUser.id, commentContent);

  if (post.user_id !== currentUser.id) {
    dbUtils.createNotification(post.user_id, "comment", currentUser.id, postId);
  }

  const mentionedUsernames = parseMentions(commentContent);
  const mentionedUsers = resolveMentions(mentionedUsernames);
  for (const user of mentionedUsers) {
    if (user.id !== currentUser.id && user.id !== post.user_id) {
      dbUtils.createNotification(user.id, "mention", currentUser.id, postId);
    }
  }

  return c.json({
    id: String(comment.id),
    postId: String(comment.post_id),
    userId: String(comment.user_id),
    username: comment.username,
    displayName: comment.display_name,
    avatar: comment.avatar || undefined,
    content: comment.content,
    createdAt: comment.created_at,
  }, 201);
});

postsRouter.delete("/:postId/comments/:commentId", ensureSession, async (c) => {
  const commentId = parseInt(c.req.param("commentId"));
  const currentUser = c.get("user");

  const comment = dbUtils.getComment(commentId);
  if (!comment) return c.json({ error: "Not found" }, 404);

  if (comment.user_id !== currentUser.id && currentUser.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  dbUtils.deleteComment(commentId);
  return c.json({ success: true });
});

postsRouter.post("/:id/vote", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");
  const body = await c.req.json();

  const poll = dbUtils.getPoll(postId);
  if (!poll) return c.json({ error: "Poll not found" }, 404);

  const optionId = parseInt(body.optionId);
  if (!Number.isFinite(optionId)) {
    return c.json({ error: "Invalid option" }, 400);
  }

  const result = dbUtils.votePoll(currentUser.id, poll.id, optionId);
  if (result.error) {
    return c.json({ error: result.error }, 400);
  }

  const updatedPoll = dbUtils.getPoll(postId);
  const userVote = dbUtils.getUserPollVote(currentUser.id, poll.id);

  return c.json({
    poll: {
      id: String(updatedPoll.id),
      question: updatedPoll.question,
      userVote: userVote ? String(userVote) : null,
      totalVotes: updatedPoll.totalVotes,
      options: updatedPoll.options.map(opt => ({
        id: String(opt.id),
        optionText: opt.option_text,
        voteCount: opt.vote_count,
        sortOrder: opt.sort_order,
      })),
    },
  });
});
