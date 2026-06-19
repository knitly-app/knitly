import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";
import { extractKeyFromUrl, deleteObject } from "../lib/media.js";
import { formatUserProfile, formatPost } from "../lib/formatters.js";

export const usersRouter = new Hono();

function formatUserWithCounts(user) {
  return {
    ...formatUserProfile(user),
    followers: dbUtils.getFollowerCount(user.id),
    following: dbUtils.getFollowingCount(user.id),
  };
}

function resolveUserId(id, currentUser) {
  if (id === "me") return currentUser.id;

  if (/^\d+$/.test(id)) {
    return Number.parseInt(id, 10);
  }

  const username = id.startsWith("@") ? id.slice(1) : id;
  if (!/^[a-zA-Z0-9_]{2,30}$/.test(username)) return null;

  const user = dbUtils.getUserByUsername(username);
  return user ? user.id : null;
}

usersRouter.get("/", ensureSession, async (c) => {
  const users = dbUtils.getAllUsers();
  return c.json(users.map(u => formatUserProfile(u)));
});

usersRouter.get("/:id", ensureSession, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const userId = resolveUserId(id, currentUser);
  if (!userId) return c.json({ error: "Not found" }, 404);

  const user = dbUtils.getUserById(userId);
  if (!user) return c.json({ error: "Not found" }, 404);

  const isFollowing = currentUser.id !== userId ? dbUtils.isFollowing(currentUser.id, userId) : false;

  return c.json({
    ...formatUserWithCounts(user),
    isFollowing,
  });
});

usersRouter.patch("/:id", ensureSession, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const userId = resolveUserId(id, currentUser);
  if (!userId) return c.json({ error: "Not found" }, 404);
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

usersRouter.get("/:id/followers", ensureSession, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const userId = resolveUserId(id, currentUser);
  if (!userId) return c.json({ error: "Not found" }, 404);

  const followers = dbUtils.getFollowers(userId);
  return c.json(followers.map(u => formatUserProfile(u)));
});

usersRouter.get("/:id/following", ensureSession, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const userId = resolveUserId(id, currentUser);
  if (!userId) return c.json({ error: "Not found" }, 404);

  const following = dbUtils.getFollowing(userId);
  return c.json(following.map(u => formatUserProfile(u)));
});

usersRouter.post("/:id/follow", ensureSession, async (c) => {
  const id = resolveUserId(c.req.param("id"), c.get("user"));
  const currentUser = c.get("user");
  if (!id) return c.json({ error: "Not found" }, 404);

  if (id === currentUser.id) return c.json({ error: "Cannot follow yourself" }, 400);

  const user = dbUtils.getUserById(id);
  if (!user) return c.json({ error: "Not found" }, 404);

  dbUtils.follow(currentUser.id, id);
  dbUtils.createNotification(id, "follow", currentUser.id);

  return c.json({ success: true });
});

usersRouter.delete("/:id/follow", ensureSession, async (c) => {
  const id = resolveUserId(c.req.param("id"), c.get("user"));
  const currentUser = c.get("user");
  if (!id) return c.json({ error: "Not found" }, 404);

  dbUtils.unfollow(currentUser.id, id);
  return c.json({ success: true });
});

usersRouter.get("/:id/posts", ensureSession, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");
  const userId = resolveUserId(id, currentUser);
  if (!userId) return c.json({ error: "Not found" }, 404);

  const mediaOnly = c.req.query("mediaOnly") === "true";
  const posts = dbUtils.getUserPosts(userId, 50, currentUser.id, mediaOnly);
  const postIds = posts.map(p => p.id);
  const reactionsMap = dbUtils.getUserReactionsMap(currentUser.id, postIds);
  const polls = dbUtils.getPollsMap(postIds);
  const pollVotes = dbUtils.getUserPollVotesMap(currentUser.id, [...polls.values()].map(p => p.id));
  return c.json(posts.map(p => {
    const poll = polls.get(p.id) || null;
    const userVote = poll ? pollVotes.get(poll.id) ?? null : null;
    return formatPost(p, { userReaction: reactionsMap.get(p.id) ?? null, poll, userVote });
  }));
});
