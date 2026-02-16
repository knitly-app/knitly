import { beforeEach, describe, expect, test } from "bun:test";
import crypto from "crypto";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/knitly-first-user-test-${testId}.db`;
process.env.USE_LOCAL_STORAGE = "true";
process.env.LOCAL_UPLOAD_DIR = `/tmp/knitly-uploads-${testId}`;
process.env.BASE_URL = "http://localhost:3000";

const { dbUtils, db } = await import("../lib/db.js");
const { createApp } = await import("../app.js");
const { COOKIE_NAME } = await import("../lib/constants.js");
const { clearRateLimitStore } = await import("../middleware/rateLimit.js");

const app = await createApp();

function resetDb() {
  db.exec("DELETE FROM chat_presence");
  db.exec("DELETE FROM chat_messages");
  db.exec("DELETE FROM audit_log");
  db.exec("DELETE FROM notifications");
  db.exec("DELETE FROM comments");
  db.exec("DELETE FROM reactions");
  db.exec("DELETE FROM post_circles");
  db.exec("DELETE FROM post_media");
  db.exec("DELETE FROM follows");
  db.exec("DELETE FROM posts");
  db.exec("DELETE FROM circle_members");
  db.exec("DELETE FROM circles");
  db.exec("DELETE FROM invites");
  db.exec("DELETE FROM sessions");
  db.exec("DELETE FROM users");
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

beforeEach(() => {
  resetDb();
  clearRateLimitStore();
});

// Note: Don't close db here - causes issues when running multiple test files together

describe("First user signup - admin assignment", () => {
  test("first user via signup gets role: admin", async () => {
    const { users: userCountBefore } = dbUtils.getStats();
    expect(userCountBefore).toBe(0);

    const signupRes = await jsonReq("/api/auth/signup", {
      method: "POST",
      body: {
        email: "first@test.com",
        password: "password123",
        username: "firstuser",
        displayName: "First User",
      },
    });

    expect(signupRes.status).toBe(201);
    const signupBody = await signupRes.json();
    expect(signupBody.role).toBe("admin");

    const userInDb = dbUtils.getUserByEmail("first@test.com");
    expect(userInDb.role).toBe("admin");
  });

  test("second user via signup without invite token fails", async () => {
    const firstUserId = dbUtils.createUser(
      "first@test.com",
      "firstuser",
      "First User",
      "hashedpw",
      "admin"
    );
    expect(firstUserId).toBeTruthy();

    const { users: userCount } = dbUtils.getStats();
    expect(userCount).toBe(1);

    const signupRes = await jsonReq("/api/auth/signup", {
      method: "POST",
      body: {
        email: "second@test.com",
        password: "password123",
        username: "seconduser",
        displayName: "Second User",
      },
    });

    expect(signupRes.status).toBe(400);
    const signupBody = await signupRes.json();
    expect(signupBody.error).toBe("Invite token required");
  });

  test("second user via signup with invite token gets role: member", async () => {
    const firstUserId = dbUtils.createUser(
      "first@test.com",
      "firstuser",
      "First User",
      "hashedpw",
      "admin"
    );
    const { token } = dbUtils.createInvite(firstUserId);

    const signupRes = await jsonReq("/api/auth/signup", {
      method: "POST",
      body: {
        email: "second@test.com",
        password: "password123",
        username: "seconduser",
        displayName: "Second User",
        inviteToken: token,
      },
    });

    expect(signupRes.status).toBe(201);
    const signupBody = await signupRes.json();
    expect(signupBody.role).toBe("member");

    const userInDb = dbUtils.getUserByEmail("second@test.com");
    expect(userInDb.role).toBe("member");
  });
});
