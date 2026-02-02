import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession, optionalAuth } from "../middleware/auth.js";

export const usersRouter = new Hono();

function formatUser(user, extras = {}) {
  return {
    id: String(user.id),
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    createdAt: user.created_at,
    ...extras,
  };
}

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

  const followers = dbUtils.getFollowerCount(userId);
  const following = dbUtils.getFollowingCount(userId);
  const isFollowing = currentUser ? dbUtils.isFollowing(currentUser.id, userId) : false;

  return c.json(formatUser(user, { followers, following, isFollowing }));
});

usersRouter.patch("/:id", ensureSession, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const userId = id === "me" ? currentUser.id : parseInt(id);
  if (userId !== currentUser.id && currentUser.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  dbUtils.updateUser(userId, body);

  const user = dbUtils.getUserById(userId);
  return c.json(formatUser(user));
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

  const posts = dbUtils.getUserPosts(userId);
  return c.json(posts.map(p => formatPost(p, currentUser ? dbUtils.isLiked(currentUser.id, p.id) : false)));
});
