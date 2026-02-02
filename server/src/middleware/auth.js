import { getCookie } from "hono/cookie";
import { dbUtils } from "../lib/db.js";
import { COOKIE_NAME } from "../lib/constants.js";

export async function ensureSession(c, next) {
  const sessionId = getCookie(c, COOKIE_NAME);

  if (!sessionId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const session = dbUtils.getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("user", {
    id: session.user_id,
    email: session.email,
    username: session.username,
    displayName: session.display_name,
    bio: session.bio,
    avatar: session.avatar,
    role: session.role,
  });

  await next();
}

export function requireRole(...allowedRoles) {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
  };
}

export async function optionalAuth(c, next) {
  const sessionId = getCookie(c, COOKIE_NAME);

  if (sessionId) {
    const session = dbUtils.getSession(sessionId);

    if (session) {
      c.set("user", {
        id: session.user_id,
        email: session.email,
        username: session.username,
        displayName: session.display_name,
        bio: session.bio,
        avatar: session.avatar,
        role: session.role,
      });
    }
  }

  if (!c.get("user")) {
    c.set("user", null);
  }

  await next();
}
