import { Hono } from "hono";
import { z } from "zod";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { dbUtils } from "../lib/db.js";
import { hashPassword, verifyPassword } from "../lib/security.js";
import { COOKIE_NAME, COOKIE_OPTIONS } from "../lib/constants.js";
import { logError } from "../lib/logging.js";

export const authRouter = new Hono();

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(2).max(30),
  displayName: z.string().min(1).max(100),
  inviteToken: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function formatUser(user) {
  return {
    id: String(user.id || user.user_id),
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    createdAt: user.created_at,
  };
}

authRouter.post("/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, username, displayName, inviteToken } = SignupSchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    const { count: userCount } = dbUtils.getStats();
    const isFirstUser = userCount === 0;

    if (!isFirstUser && !inviteToken) {
      return c.json({ error: "Invite token required" }, 400);
    }

    if (inviteToken) {
      const invite = dbUtils.getInviteByToken(inviteToken);
      if (!invite) return c.json({ error: "Invalid invite token" }, 400);
      if (invite.used) return c.json({ error: "Invite already used" }, 400);
    }

    if (dbUtils.getUserByEmail(normalizedEmail)) {
      return c.json({ error: "Email already registered" }, 400);
    }

    if (dbUtils.getUserByUsername(username)) {
      return c.json({ error: "Username already taken" }, 400);
    }

    const passwordHash = await hashPassword(password);
    const userId = dbUtils.createUser(normalizedEmail, username, displayName, passwordHash);

    if (inviteToken) {
      const invite = dbUtils.getInviteByToken(inviteToken);
      if (invite) dbUtils.markInviteUsed(invite.id, userId);
    }

    const existingUserIds = dbUtils.getAllUserIds(userId);
    for (const existingUserId of existingUserIds) {
      dbUtils.follow(userId, existingUserId);
      dbUtils.follow(existingUserId, userId);
    }

    const { sessionId } = dbUtils.createSession(userId);
    setCookie(c, COOKIE_NAME, sessionId, COOKIE_OPTIONS);

    const user = dbUtils.getUserById(userId);
    return c.json(formatUser(user), 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Signup error.");
    return c.json({ error: "Signup failed" }, 500);
  }
});

authRouter.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = LoginSchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    const user = dbUtils.getUserByEmail(normalizedEmail);
    if (!user) return c.json({ error: "Invalid credentials" }, 401);

    const valid = await verifyPassword(user.password_hash, password);
    if (!valid) return c.json({ error: "Invalid credentials" }, 401);

    const { sessionId } = dbUtils.createSession(user.id);
    setCookie(c, COOKIE_NAME, sessionId, COOKIE_OPTIONS);

    return c.json(formatUser(user));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Login error.");
    return c.json({ error: "Login failed" }, 500);
  }
});

authRouter.post("/logout", async (c) => {
  const sessionId = getCookie(c, COOKIE_NAME);
  if (sessionId) dbUtils.deleteSession(sessionId);

  deleteCookie(c, COOKIE_NAME, {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
    path: COOKIE_OPTIONS.path,
  });

  return c.json({ success: true });
});

authRouter.get("/me", async (c) => {
  const sessionId = getCookie(c, COOKIE_NAME);
  if (!sessionId) return c.json({ error: "Not authenticated" }, 401);

  const session = dbUtils.getSession(sessionId);
  if (!session) {
    deleteCookie(c, COOKIE_NAME, {
      httpOnly: COOKIE_OPTIONS.httpOnly,
      secure: COOKIE_OPTIONS.secure,
      sameSite: COOKIE_OPTIONS.sameSite,
      path: COOKIE_OPTIONS.path,
    });
    return c.json({ error: "Session expired" }, 401);
  }

  return c.json(formatUser(session));
});
