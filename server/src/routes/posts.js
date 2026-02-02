import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";

export const postsRouter = new Hono();

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

postsRouter.get("/:id", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  const liked = currentUser ? dbUtils.isLiked(currentUser.id, postId) : false;
  return c.json(formatPost(post, liked));
});

postsRouter.post("/", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();

  const content = typeof body.content === "string" ? body.content.trim() : "";
  const rawMedia = Array.isArray(body.media) ? body.media : [];
  const media = rawMedia
    .filter((item) => item && typeof item.url === "string")
    .slice(0, 6)
    .map((item, index) => ({
      url: item.url,
      width: Number.isFinite(item.width) ? item.width : null,
      height: Number.isFinite(item.height) ? item.height : null,
      type: "image",
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

  if (!content && media.length === 0) {
    return c.json({ error: "Content or media required" }, 400);
  }

  const post = dbUtils.createPost(currentUser.id, content, media);
  const liked = dbUtils.isLiked(currentUser.id, post.id);
  return c.json(formatPost(post, liked), 201);
});

postsRouter.delete("/:id", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  if (post.user_id !== currentUser.id && currentUser.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  dbUtils.deletePost(postId);
  return c.json({ success: true });
});

postsRouter.post("/:id/like", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  dbUtils.likePost(currentUser.id, postId);

  if (post.user_id !== currentUser.id) {
    dbUtils.createNotification(post.user_id, "like", currentUser.id, postId);
  }

  return c.json({ success: true });
});

postsRouter.delete("/:id/like", ensureSession, async (c) => {
  const postId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  dbUtils.unlikePost(currentUser.id, postId);
  return c.json({ success: true });
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

  if (!body.content?.trim()) {
    return c.json({ error: "Content required" }, 400);
  }

  const post = dbUtils.getPost(postId);
  if (!post) return c.json({ error: "Not found" }, 404);

  const comment = dbUtils.createComment(postId, currentUser.id, body.content);

  if (post.user_id !== currentUser.id) {
    dbUtils.createNotification(post.user_id, "comment", currentUser.id, postId);
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
