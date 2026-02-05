import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession, optionalAuth } from "../middleware/auth.js";
import { extractKeyFromUrl, deleteObject } from "../lib/media.js";

export const usersRouter = new Hono();

function formatUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || undefined,
    header: user.header || undefined,
    bio: user.bio || undefined,
    location: user.location || undefined,
    website: user.website || undefined,
    role: user.role,
    createdAt: user.created_at,
  };
}

function formatUserWithCounts(user) {
  return {
    ...formatUser(user),
    followers: dbUtils.getFollowerCount(user.id),
    following: dbUtils.getFollowingCount(user.id),
  };
}

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

usersRouter.get("/", ensureSession, async (c) => {
  const users = dbUtils.getAllUsers();
  return c.json(users.map(u => formatUser(u)));
});

usersRouter.get("/:id", optionalAuth, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const userId = id === "me" ? currentUser?.id : parseInt(id);
  if (!userId) return c.json({ error: "Not found" }, 404);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "Not found" }, 404);

  const isFollowing =
    currentUser && currentUser.id !== userId ? dbUtils.isFollowing(currentUser.id, userId) : false;

  return c.json({
    ...formatUserWithCounts(user),
    isFollowing,
  });
});

usersRouter.patch("/:id", ensureSession, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const userId = id === "me" ? currentUser.id : parseInt(id);
  if (userId !== currentUser.id && currentUser.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const existingUser = dbUtils.getUserById(userId);
  const oldAvatar = existingUser?.avatar;
  const oldHeader = existingUser?.header;

  const body = await c.req.json();
  dbUtils.updateUser(userId, body);

  const user = dbUtils.getUserById(userId);

  if (oldAvatar && user.avatar !== oldAvatar) {
    const key = extractKeyFromUrl(oldAvatar);
    if (key) deleteObject(key).catch(() => {});
  }
  if (oldHeader && user.header !== oldHeader) {
    const key = extractKeyFromUrl(oldHeader);
    if (key) deleteObject(key).catch(() => {});
  }

  return c.json(formatUserWithCounts(user));
});

usersRouter.get("/:id/followers", optionalAuth, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const userId = id === "me" ? currentUser?.id : parseInt(id);
  if (!userId) return c.json({ error: "Not found" }, 404);

  const followers = dbUtils.getFollowers(userId);
  return c.json(followers.map(u => formatUser(u)));
});

usersRouter.get("/:id/following", optionalAuth, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const userId = id === "me" ? currentUser?.id : parseInt(id);
  if (!userId) return c.json({ error: "Not found" }, 404);

  const following = dbUtils.getFollowing(userId);
  return c.json(following.map(u => formatUser(u)));
});

usersRouter.post("/:id/follow", ensureSession, async (c) => {
  const id = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  if (id === currentUser.id) return c.json({ error: "Cannot follow yourself" }, 400);

  const user = dbUtils.getUserById(id);
  if (!user) return c.json({ error: "Not found" }, 404);

  dbUtils.follow(currentUser.id, id);
  dbUtils.createNotification(id, "follow", currentUser.id);

  return c.json({ success: true });
});

usersRouter.delete("/:id/follow", ensureSession, async (c) => {
  const id = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  dbUtils.unfollow(currentUser.id, id);
  return c.json({ success: true });
});

usersRouter.get("/:id/posts", optionalAuth, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const userId = id === "me" ? currentUser?.id : parseInt(id);
  if (!userId) return c.json({ error: "Not found" }, 404);

  const posts = dbUtils.getUserPosts(userId, 50, currentUser?.id ?? null);
  const reactionsMap = currentUser ? dbUtils.getUserReactionsMap(currentUser.id, posts.map(p => p.id)) : new Map();
  return c.json(posts.map(p => {
    const poll = dbUtils.getPoll(p.id);
    const userVote = poll && currentUser ? dbUtils.getUserPollVote(currentUser.id, poll.id) : null;
    return formatPost(p, reactionsMap.get(p.id) ?? null, poll, userVote);
  }));
});
