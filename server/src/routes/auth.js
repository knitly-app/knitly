import crypto from "crypto";
import { Hono } from "hono";
import { z } from "zod";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { dbUtils } from "../lib/db.js";
import { hashPassword, verifyPassword } from "../lib/security.js";
import { COOKIE_NAME, COOKIE_OPTIONS } from "../lib/constants.js";
import { logError } from "../lib/logging.js";
import { authRateLimit } from "../middleware/rateLimit.js";

export const authRouter = new Hono();

authRouter.use("/login", authRateLimit);
authRouter.use("/signup", authRateLimit);

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
    role: user.role,
    createdAt: user.created_at,
  };
}

authRouter.post("/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, username, displayName, inviteToken } = SignupSchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    const { users: userCount } = dbUtils.getStats();
    const isFirstUser = userCount === 0;

    if (!isFirstUser && !inviteToken) {
      return c.json({ error: "Invite token required" }, 400);
    }

    if (inviteToken) {
      const invite = dbUtils.getInviteByToken(inviteToken);
      if (!invite) return c.json({ error: "Invalid invite token" }, 400);
      if (invite.used) return c.json({ error: "Invite already used" }, 400);
      if (invite.revoked_at) return c.json({ error: "Invite revoked" }, 400);
      if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        return c.json({ error: "Invite expired" }, 400);
      }
    }

    if (dbUtils.getUserByEmail(normalizedEmail)) {
      return c.json({ error: "Email already registered" }, 400);
    }

    if (dbUtils.getUserByUsername(username)) {
      return c.json({ error: "Username already taken" }, 400);
    }

    const passwordHash = await hashPassword(password);
    const role = isFirstUser ? "admin" : "member";
    const userId = dbUtils.createUser(normalizedEmail, username, displayName, passwordHash, role);

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
    if (user.disabled_at) return c.json({ error: "Account disabled" }, 403);
    if (user.role === 'bot') return c.json({ error: "Bot accounts cannot log in" }, 403);

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

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

authRouter.use("/reset-password/*", authRateLimit);
authRouter.use("/reset-password", authRateLimit);

authRouter.get("/reset-password/:token", (c) => {
  const token = c.req.param("token");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = dbUtils.getResetToken(tokenHash);
  if (!record) return c.json({ valid: false, reason: "invalid" });

  if (new Date(record.expires_at).getTime() < Date.now()) {
    dbUtils.deleteResetToken(tokenHash);
    return c.json({ valid: false, reason: "expired" });
  }

  if (record.disabled_at) return c.json({ valid: false, reason: "disabled" });

  return c.json({ valid: true, username: record.username, displayName: record.display_name });
});

authRouter.post("/reset-password", async (c) => {
  try {
    const body = await c.req.json();
    const { token, password } = ResetPasswordSchema.parse(body);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const record = dbUtils.getResetToken(tokenHash);
    if (!record) return c.json({ error: "Invalid or expired token" }, 400);

    if (new Date(record.expires_at).getTime() < Date.now()) {
      dbUtils.deleteResetToken(tokenHash);
      return c.json({ error: "Token expired" }, 400);
    }

    if (record.disabled_at) return c.json({ error: "Account disabled" }, 403);

    const passwordHash = await hashPassword(password);
    dbUtils.updatePasswordHash(record.user_id, passwordHash);
    dbUtils.deleteSessionsByUser(record.user_id);
    dbUtils.deleteResetToken(tokenHash);
    dbUtils.createAuditEntry(record.user_id, "PASSWORD_RESET_COMPLETED", "user", record.user_id);

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Password reset error.");
    return c.json({ error: "Password reset failed" }, 500);
  }
});
