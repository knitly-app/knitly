import crypto from "crypto";
import { Hono } from "hono";
import { z } from "zod";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { dbUtils } from "../lib/db.js";
import { hashPassword, verifyPassword, generateRandomToken } from "../lib/security.js";
import { COOKIE_NAME, COOKIE_OPTIONS } from "../lib/constants.js";
import { logError } from "../lib/logging.js";
import { authRateLimit, forgotPasswordRateLimit } from "../middleware/rateLimit.js";
import { sendPasswordResetEmail, sendEmailChangeConfirmation, sendAccountDeletionEmail } from "../lib/email.js";
import { ensureSession } from "../middleware/auth.js";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clearSessionCookie(c) {
  deleteCookie(c, COOKIE_NAME, {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
    path: COOKIE_OPTIONS.path,
  });
}

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

function formatUser(user, includeEmail = false) {
  const result = {
    id: String(user.id || user.user_id),
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    role: user.role,
    createdAt: user.created_at,
  };
  if (includeEmail && user.email) result.email = user.email;
  return result;
}

const DELETION_GRACE_DAYS = 30;

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
    return c.json(formatUser(user, true), 201);
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
    if (user.role === 'bot') return c.json({ error: "Bot accounts cannot log in" }, 403);

    const valid = await verifyPassword(user.password_hash, password);
    if (!valid) return c.json({ error: "Invalid credentials" }, 401);

    if (user.disabled_at) {
      const disabledDate = new Date(user.disabled_at);
      const gracePeriodEnd = new Date(disabledDate.getTime() + DELETION_GRACE_DAYS * MS_PER_DAY);
      if (new Date() > gracePeriodEnd) {
        return c.json({ error: "Account has been deleted" }, 403);
      }
      dbUtils.enableUser(user.id);
      dbUtils.createAuditEntry(user.id, "ACCOUNT_DELETION_CANCELLED", "user", user.id, { reason: "login_during_grace_period" });
      const { sessionId } = dbUtils.createSession(user.id);
      setCookie(c, COOKIE_NAME, sessionId, COOKIE_OPTIONS);
      return c.json({ ...formatUser(user, true), restoredFromDeletion: true });
    }

    const { sessionId } = dbUtils.createSession(user.id);
    setCookie(c, COOKIE_NAME, sessionId, COOKIE_OPTIONS);

    return c.json(formatUser(user, true));
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

  clearSessionCookie(c);

  return c.json({ success: true });
});

authRouter.get("/me", async (c) => {
  const sessionId = getCookie(c, COOKIE_NAME);
  if (!sessionId) return c.json({ error: "Not authenticated" }, 401);

  const session = dbUtils.getSession(sessionId);
  if (!session) {
    clearSessionCookie(c);
    return c.json({ error: "Session expired" }, 401);
  }

  if (session.disabled_at) {
    dbUtils.deleteSession(sessionId);
    clearSessionCookie(c);
    return c.json({ error: "Account disabled" }, 403);
  }

  return c.json(formatUser(session, true));
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

authRouter.use("/reset-password/*", authRateLimit);
authRouter.use("/reset-password", authRateLimit);

authRouter.get("/reset-password/:token", (c) => {
  const token = c.req.param("token");
  const tokenHash = hashToken(token);

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
    const tokenHash = hashToken(token);

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

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

authRouter.use("/forgot-password", forgotPasswordRateLimit);

authRouter.post("/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = ForgotPasswordSchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    const user = dbUtils.getUserByEmail(normalizedEmail);
    if (user && !user.disabled_at && user.role !== "bot") {
      const token = generateRandomToken(32);
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + MS_PER_DAY).toISOString();
      dbUtils.createResetToken(user.id, tokenHash, expiresAt);
      dbUtils.createAuditEntry(user.id, "PASSWORD_RESET_REQUESTED", "user", user.id);
      await sendPasswordResetEmail(normalizedEmail, token, user.display_name);
    }

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Forgot password error.");
    return c.json({ success: true });
  }
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.use("/change-password", authRateLimit);

authRouter.post("/change-password", ensureSession, async (c) => {
  try {
    const body = await c.req.json();
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(body);
    const currentUser = c.get("user");

    const passwordHash = dbUtils.getPasswordHash(currentUser.id);
    if (!passwordHash) return c.json({ error: "Cannot change password" }, 400);

    const valid = await verifyPassword(passwordHash, currentPassword);
    if (!valid) return c.json({ error: "Current password is incorrect" }, 401);

    const newHash = await hashPassword(newPassword);
    dbUtils.updatePasswordHash(currentUser.id, newHash);
    dbUtils.deleteSessionsByUser(currentUser.id);
    dbUtils.createAuditEntry(currentUser.id, "PASSWORD_CHANGED", "user", currentUser.id);

    const { sessionId } = dbUtils.createSession(currentUser.id);
    setCookie(c, COOKIE_NAME, sessionId, COOKIE_OPTIONS);

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Change password error.");
    return c.json({ error: "Failed to change password" }, 500);
  }
});

const ChangeEmailSchema = z.object({
  newEmail: z.string().email(),
});

authRouter.use("/change-email", authRateLimit);

authRouter.post("/change-email", ensureSession, async (c) => {
  try {
    const body = await c.req.json();
    const { newEmail } = ChangeEmailSchema.parse(body);
    const normalizedEmail = newEmail.trim().toLowerCase();
    const currentUser = c.get("user");

    if (normalizedEmail === currentUser.email) {
      return c.json({ error: "New email is the same as current" }, 400);
    }

    if (dbUtils.getUserByEmail(normalizedEmail)) {
      return c.json({ error: "Email already in use" }, 400);
    }

    const token = generateRandomToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + MS_PER_DAY).toISOString();
    dbUtils.createEmailChangeToken(currentUser.id, normalizedEmail, tokenHash, expiresAt);

    await sendEmailChangeConfirmation(token, currentUser.display_name, normalizedEmail);

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Change email error.");
    return c.json({ error: "Failed to initiate email change" }, 500);
  }
});

authRouter.get("/confirm-email/:token", async (c) => {
  const token = c.req.param("token");
  const tokenHash = hashToken(token);

  const record = dbUtils.getEmailChangeToken(tokenHash);
  if (!record) return c.json({ error: "Invalid or expired token" }, 400);

  if (new Date(record.expires_at).getTime() < Date.now()) {
    dbUtils.deleteEmailChangeToken(tokenHash);
    return c.json({ error: "Token expired" }, 400);
  }

  if (dbUtils.getUserByEmail(record.new_email)) {
    dbUtils.deleteEmailChangeToken(tokenHash);
    return c.json({ error: "Email already in use" }, 400);
  }

  dbUtils.updateUserEmail(record.user_id, record.new_email);
  dbUtils.deleteEmailChangeToken(tokenHash);
  dbUtils.createAuditEntry(record.user_id, "EMAIL_CHANGED", "user", record.user_id, {
    oldEmail: record.email,
    newEmail: record.new_email,
  });

  return c.json({ success: true });
});

const DeleteAccountSchema = z.object({
  password: z.string().min(1),
});

authRouter.use("/delete-account", authRateLimit);

authRouter.post("/delete-account", ensureSession, async (c) => {
  try {
    const body = await c.req.json();
    const { password } = DeleteAccountSchema.parse(body);
    const currentUser = c.get("user");

    const passwordHash = dbUtils.getPasswordHash(currentUser.id);
    if (!passwordHash) return c.json({ error: "Cannot delete this account" }, 400);

    const valid = await verifyPassword(passwordHash, password);
    if (!valid) return c.json({ error: "Incorrect password" }, 401);

    if (currentUser.role === "admin") {
      const adminCount = dbUtils.getAdminCount();
      if (adminCount <= 1) {
        return c.json({ error: "You are the only admin. Transfer admin role before deleting your account." }, 403);
      }
    }

    const disabledAt = dbUtils.disableUser(currentUser.id);
    const deletionDate = new Date(new Date(disabledAt).getTime() + DELETION_GRACE_DAYS * MS_PER_DAY).toISOString();
    dbUtils.deleteSessionsByUser(currentUser.id);
    dbUtils.createAuditEntry(currentUser.id, "ACCOUNT_DELETION_REQUESTED", "user", currentUser.id);

    await sendAccountDeletionEmail(currentUser.email, currentUser.display_name, new Date(deletionDate).toLocaleDateString());

    clearSessionCookie(c);

    return c.json({ success: true, deletionDate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    logError("Delete account error.");
    return c.json({ error: "Failed to delete account" }, 500);
  }
});

authRouter.post("/cancel-deletion", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const user = dbUtils.getUserById(currentUser.id);

  if (!user || !user.disabled_at) {
    return c.json({ error: "Account is not pending deletion" }, 400);
  }

  dbUtils.enableUser(currentUser.id);
  dbUtils.createAuditEntry(currentUser.id, "ACCOUNT_DELETION_CANCELLED", "user", currentUser.id);

  return c.json({ success: true });
});
