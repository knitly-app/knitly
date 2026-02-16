import crypto from "crypto";
import { getCookie } from "hono/cookie";
import { dbUtils } from "../lib/db.js";
import { COOKIE_NAME } from "../lib/constants.js";

export async function ensureSession(c, next) {
  const sessionId = getCookie(c, COOKIE_NAME);

  if (!sessionId) {
    const authHeader = c.req.header("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      if (token.startsWith("knitly_")) {
        const keyHash = crypto.createHash("sha256").update(token).digest("hex");
        const apiKey = dbUtils.getApiKeyByHash(keyHash);

        if (!apiKey) {
          return c.json({ error: "Invalid API key" }, 401);
        }

        if (apiKey.disabled_at) {
          return c.json({ error: "Account disabled" }, 403);
        }

        dbUtils.updateApiKeyLastUsed(apiKey.id);

        c.set("user", {
          id: apiKey.user_id,
          email: apiKey.email,
          username: apiKey.username,
          displayName: apiKey.display_name,
          bio: apiKey.bio,
          avatar: apiKey.avatar,
          role: apiKey.role,
          disabledAt: apiKey.disabled_at,
        });
        c.set("authMethod", "api_key");

        return next();
      }
    }
    return c.json({ error: "Unauthorized" }, 401);
  }

  const session = dbUtils.getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session expired" }, 401);
  }

  if (session.disabled_at) {
    dbUtils.deleteSession(sessionId);
    return c.json({ error: "Account disabled" }, 403);
  }

  c.set("user", {
    id: session.user_id,
    email: session.email,
    username: session.username,
    displayName: session.display_name,
    bio: session.bio,
    avatar: session.avatar,
    role: session.role,
    disabledAt: session.disabled_at,
  });
  c.set("authMethod", "session");

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

    if (session && !session.disabled_at) {
      c.set("user", {
        id: session.user_id,
        email: session.email,
        username: session.username,
        displayName: session.display_name,
        bio: session.bio,
        avatar: session.avatar,
        role: session.role,
        disabledAt: session.disabled_at,
      });
    }
  }

  if (!c.get("user")) {
    c.set("user", null);
  }

  await next();
}
