import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";

const MAX_CIRCLES = 4;

export const circlesRouter = new Hono();

function formatCircle(circle) {
  return {
    id: String(circle.id),
    userId: String(circle.user_id),
    name: circle.name,
    color: circle.color,
    createdAt: circle.created_at,
    memberCount: circle.member_count ?? 0,
  };
}

function formatCircleWithOwner(circle) {
  return {
    id: String(circle.id),
    userId: String(circle.user_id),
    name: circle.name,
    color: circle.color,
    createdAt: circle.created_at,
    owner: {
      username: circle.owner_username,
      displayName: circle.owner_display_name,
      avatar: circle.owner_avatar || undefined,
    },
  };
}

function formatMember(member) {
  return {
    id: String(member.id),
    username: member.username,
    displayName: member.display_name,
    avatar: member.avatar || undefined,
    bio: member.bio || undefined,
    joinedAt: member.joined_at,
  };
}

circlesRouter.get("/", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const circles = dbUtils.getUserCircles(currentUser.id);
  return c.json(circles.map(formatCircle));
});

circlesRouter.post("/", ensureSession, async (c) => {
  const currentUser = c.get("user");

  const existingCircles = dbUtils.getUserCircles(currentUser.id);
  if (existingCircles.length >= MAX_CIRCLES) {
    return c.json({ error: "Maximum 4 circles allowed" }, 400);
  }

  const body = await c.req.json();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return c.json({ error: "Name required" }, 400);
  }

  const color = typeof body.color === "string" ? body.color : "blue";
  const circle = dbUtils.createCircle(currentUser.id, name, color);

  return c.json(formatCircleWithOwner(circle), 201);
});

circlesRouter.get("/:id", ensureSession, async (c) => {
  const circleId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const circle = dbUtils.getCircle(circleId);
  if (!circle) return c.json({ error: "Not found" }, 404);

  const isOwner = circle.user_id === currentUser.id;
  const isMember = dbUtils.isCircleMember(circleId, currentUser.id);

  if (!isOwner && !isMember) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const members = dbUtils.getCircleMembers(circleId);

  return c.json({
    ...formatCircleWithOwner(circle),
    members: members.map(formatMember),
  });
});

circlesRouter.patch("/:id", ensureSession, async (c) => {
  const circleId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const circle = dbUtils.getCircle(circleId);
  if (!circle) return c.json({ error: "Not found" }, 404);

  if (circle.user_id !== currentUser.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const updates = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "Name required" }, 400);
    updates.name = name;
  }
  if (body.color !== undefined) {
    updates.color = body.color;
  }

  const updated = dbUtils.updateCircle(circleId, updates);
  return c.json(formatCircleWithOwner(updated));
});

circlesRouter.delete("/:id", ensureSession, async (c) => {
  const circleId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const circle = dbUtils.getCircle(circleId);
  if (!circle) return c.json({ error: "Not found" }, 404);

  if (circle.user_id !== currentUser.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  dbUtils.deleteCircle(circleId);
  return c.json({ success: true });
});

circlesRouter.post("/:id/members", ensureSession, async (c) => {
  const circleId = parseInt(c.req.param("id"));
  const currentUser = c.get("user");

  const circle = dbUtils.getCircle(circleId);
  if (!circle) return c.json({ error: "Not found" }, 404);

  if (circle.user_id !== currentUser.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((id) => typeof id === "number")
    : typeof body.userId === "number"
      ? [body.userId]
      : [];

  if (userIds.length === 0) {
    return c.json({ error: "No valid user IDs provided" }, 400);
  }

  let added = 0;
  for (const userId of userIds) {
    const user = dbUtils.getUserById(userId);
    if (user && !dbUtils.isCircleMember(circleId, userId)) {
      dbUtils.addCircleMember(circleId, userId);
      added++;
    }
  }

  return c.json({ success: true, added });
});

circlesRouter.delete("/:id/members/:userId", ensureSession, async (c) => {
  const circleId = parseInt(c.req.param("id"));
  const userId = parseInt(c.req.param("userId"));
  const currentUser = c.get("user");

  const circle = dbUtils.getCircle(circleId);
  if (!circle) return c.json({ error: "Not found" }, 404);

  if (circle.user_id !== currentUser.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  dbUtils.removeCircleMember(circleId, userId);
  return c.json({ success: true });
});
