import { beforeEach, describe, expect, test } from "bun:test";
import crypto from "crypto";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/knitly-pw-reset-test-${testId}.db`;
process.env.USE_LOCAL_STORAGE = "true";
process.env.LOCAL_UPLOAD_DIR = `/tmp/knitly-uploads-${testId}`;
process.env.BASE_URL = "http://localhost:3000";

const { dbUtils, db } = await import("../lib/db.js");
const { createApp } = await import("../app.js");
const { COOKIE_NAME } = await import("../lib/constants.js");
const { clearRateLimitStore } = await import("../middleware/rateLimit.js");
const { hashPassword } = await import("../lib/security.js");

const app = createApp();

function resetDb() {
  db.exec("DELETE FROM chat_presence");
  db.exec("DELETE FROM chat_messages");
  db.exec("DELETE FROM audit_log");
  db.exec("DELETE FROM notifications");
  db.exec("DELETE FROM comments");
  db.exec("DELETE FROM reactions");
  db.exec("DELETE FROM post_media");
  db.exec("DELETE FROM post_circles");
  db.exec("DELETE FROM circle_members");
  db.exec("DELETE FROM circles");
  db.exec("DELETE FROM follows");
  db.exec("DELETE FROM posts");
  db.exec("DELETE FROM invites");
  db.exec("DELETE FROM password_reset_tokens");
  db.exec("DELETE FROM sessions");
  db.exec("DELETE FROM users");
  db.exec("DELETE FROM settings");
  db.exec("DELETE FROM sqlite_sequence");
}

async function jsonReq(path, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = `${COOKIE_NAME}=${cookie}`;
  return app.request(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

let adminId, memberId, adminSession, memberSession;

async function seedUsers() {
  const pw = await hashPassword("password123");
  adminId = dbUtils.createUser("admin@test.com", "admin", "Admin User", pw, "admin");
  memberId = dbUtils.createUser("member@test.com", "member", "Member User", pw, "member");
  adminSession = dbUtils.createSession(adminId).sessionId;
  memberSession = dbUtils.createSession(memberId).sessionId;
}

beforeEach(async () => {
  resetDb();
  clearRateLimitStore();
  await seedUsers();
});

describe("Admin generates reset token - POST /api/admin/users/:id/reset-password", () => {
  test("admin can generate reset link for a member", async () => {
    const res = await jsonReq(`/api/admin/users/${memberId}/reset-password`, {
      method: "POST",
      cookie: adminSession,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(typeof body.token).toBe("string");
    expect(body.expiresAt).toBeTruthy();
  });

  test("admin cannot reset own password (owner role blocked)", async () => {
    const res = await jsonReq(`/api/admin/users/${adminId}/reset-password`, {
      method: "POST",
      cookie: adminSession,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("owner");
  });

  test("admin cannot reset another admin/owner password", async () => {
    const pw = await hashPassword("password123");
    const otherAdminId = dbUtils.createUser("admin2@test.com", "admin2", "Admin 2", pw, "admin");

    const res = await jsonReq(`/api/admin/users/${otherAdminId}/reset-password`, {
      method: "POST",
      cookie: adminSession,
    });

    expect(res.status).toBe(400);
  });

  test("non-admin member cannot generate reset link", async () => {
    const res = await jsonReq(`/api/admin/users/${adminId}/reset-password`, {
      method: "POST",
      cookie: memberSession,
    });

    expect(res.status).toBe(403);
  });

  test("cannot generate for non-existent user", async () => {
    const res = await jsonReq("/api/admin/users/99999/reset-password", {
      method: "POST",
      cookie: adminSession,
    });

    expect(res.status).toBe(404);
  });
});

describe("Validate reset token - GET /api/auth/reset-password/:token", () => {
  async function generateTokenForMember() {
    const res = await jsonReq(`/api/admin/users/${memberId}/reset-password`, {
      method: "POST",
      cookie: adminSession,
    });
    return (await res.json()).token;
  }

  test("valid token returns valid: true with user info", async () => {
    const token = await generateTokenForMember();

    const res = await jsonReq(`/api/auth/reset-password/${token}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.username).toBe("member");
    expect(body.displayName).toBe("Member User");
  });

  test("invalid/random token returns valid: false, reason: invalid", async () => {
    const res = await jsonReq("/api/auth/reset-password/totally-bogus-token-1234");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("invalid");
  });

  test("expired token returns valid: false, reason: expired", async () => {
    const token = "expired-test-token";
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expired = new Date(Date.now() - 60_000).toISOString();
    dbUtils.createResetToken(memberId, tokenHash, expired);

    const res = await jsonReq(`/api/auth/reset-password/${token}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("expired");
  });

  test("disabled user's token returns valid: false, reason: disabled", async () => {
    const token = await generateTokenForMember();
    dbUtils.disableUser(memberId);

    const res = await jsonReq(`/api/auth/reset-password/${token}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("disabled");
  });
});

describe("Consume reset token - POST /api/auth/reset-password", () => {
  async function generateTokenForMember() {
    const res = await jsonReq(`/api/admin/users/${memberId}/reset-password`, {
      method: "POST",
      cookie: adminSession,
    });
    return (await res.json()).token;
  }

  test("valid token + valid password resets successfully", async () => {
    const token = await generateTokenForMember();

    const res = await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "newpassword123" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("after reset, user can login with new password", async () => {
    const token = await generateTokenForMember();
    await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "brandnewpass" },
    });

    const loginRes = await jsonReq("/api/auth/login", {
      method: "POST",
      body: { email: "member@test.com", password: "brandnewpass" },
    });

    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.username).toBe("member");
  });

  test("after reset, old password no longer works", async () => {
    const token = await generateTokenForMember();
    await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "brandnewpass" },
    });

    const loginRes = await jsonReq("/api/auth/login", {
      method: "POST",
      body: { email: "member@test.com", password: "password123" },
    });

    expect(loginRes.status).toBe(401);
  });

  test("after reset, existing sessions are revoked", async () => {
    const token = await generateTokenForMember();

    const meBeforeRes = await jsonReq("/api/auth/me", { cookie: memberSession });
    expect(meBeforeRes.status).toBe(200);

    await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "brandnewpass" },
    });

    const meAfterRes = await jsonReq("/api/auth/me", { cookie: memberSession });
    expect(meAfterRes.status).toBe(401);
  });

  test("token is single-use — second POST fails", async () => {
    const token = await generateTokenForMember();

    const first = await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "newpassword1" },
    });
    expect(first.status).toBe(200);

    const second = await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "newpassword2" },
    });
    expect(second.status).toBe(400);
  });

  test("password too short (< 8 chars) is rejected", async () => {
    const token = await generateTokenForMember();

    const res = await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "short" },
    });

    expect(res.status).toBe(400);
  });

  test("invalid token is rejected", async () => {
    const res = await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token: "nonexistent-token-xyz", password: "validpassword123" },
    });

    expect(res.status).toBe(400);
  });

  test("expired token is rejected", async () => {
    const token = "expired-consume-token";
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expired = new Date(Date.now() - 60_000).toISOString();
    dbUtils.createResetToken(memberId, tokenHash, expired);

    const res = await jsonReq("/api/auth/reset-password", {
      method: "POST",
      body: { token, password: "validpassword123" },
    });

    expect(res.status).toBe(400);
  });
});

describe("Edge cases", () => {
  test("generating a new token invalidates the previous one", async () => {
    const firstRes = await jsonReq(`/api/admin/users/${memberId}/reset-password`, {
      method: "POST",
      cookie: adminSession,
    });
    const firstToken = (await firstRes.json()).token;

    const secondRes = await jsonReq(`/api/admin/users/${memberId}/reset-password`, {
      method: "POST",
      cookie: adminSession,
    });
    const secondToken = (await secondRes.json()).token;

    const validateFirst = await jsonReq(`/api/auth/reset-password/${firstToken}`);
    const firstBody = await validateFirst.json();
    expect(firstBody.valid).toBe(false);

    const validateSecond = await jsonReq(`/api/auth/reset-password/${secondToken}`);
    const secondBody = await validateSecond.json();
    expect(secondBody.valid).toBe(true);
  });
});
