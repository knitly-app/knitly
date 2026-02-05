import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "crypto";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/knitly-setup-test-${testId}.db`;
process.env.USE_LOCAL_STORAGE = "true";
process.env.LOCAL_UPLOAD_DIR = `/tmp/knitly-uploads-${testId}`;
process.env.BASE_URL = "http://localhost:3000";

const { dbUtils, db } = await import("../lib/db.js");
const { createApp } = await import("../app.js");
const { COOKIE_NAME } = await import("../lib/constants.js");

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
  db.exec("DELETE FROM sessions");
  db.exec("DELETE FROM users");
  db.exec("DELETE FROM settings");
  db.exec("DELETE FROM sqlite_sequence");
}

function getSessionCookie(res) {
  const cookie = res.headers.get("set-cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
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
});

afterAll(() => {
  db.close();
});

describe("Setup API - GET /api/setup/status", () => {
  test("returns needsSetup: true when no users exist", async () => {
    const res = await jsonReq("/api/setup/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsSetup).toBe(true);
  });

  test("returns needsSetup: false when users exist", async () => {
    const { hashPassword } = await import("../lib/security.js");
    const passwordHash = await hashPassword("password123");
    dbUtils.createUser("admin@test.com", "admin", "Admin", passwordHash, "admin");

    const res = await jsonReq("/api/setup/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsSetup).toBe(false);
  });
});

describe("Setup API - POST /api/setup/complete", () => {
  test("creates admin user with valid data", async () => {
    const res = await jsonReq("/api/setup/complete", {
      method: "POST",
      body: {
        email: "admin@example.com",
        password: "securepassword123",
        username: "admin",
        displayName: "Administrator",
      },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.username).toBe("admin");
    expect(body.displayName).toBe("Administrator");
    expect(body.role).toBe("admin");

    const user = dbUtils.getUserByEmail("admin@example.com");
    expect(user).toBeTruthy();
    expect(user.role).toBe("admin");
  });

  test("returns 400 for invalid email", async () => {
    const res = await jsonReq("/api/setup/complete", {
      method: "POST",
      body: {
        email: "not-an-email",
        password: "securepassword123",
        username: "admin",
        displayName: "Administrator",
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("returns 400 for short password (< 8 chars)", async () => {
    const res = await jsonReq("/api/setup/complete", {
      method: "POST",
      body: {
        email: "admin@example.com",
        password: "short",
        username: "admin",
        displayName: "Administrator",
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("returns 400 for missing fields", async () => {
    const res = await jsonReq("/api/setup/complete", {
      method: "POST",
      body: {
        email: "admin@example.com",
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("returns 400 if setup already completed", async () => {
    const { hashPassword } = await import("../lib/security.js");
    const passwordHash = await hashPassword("password123");
    dbUtils.createUser("existing@test.com", "existing", "Existing", passwordHash, "admin");

    const res = await jsonReq("/api/setup/complete", {
      method: "POST",
      body: {
        email: "admin@example.com",
        password: "securepassword123",
        username: "admin",
        displayName: "Administrator",
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("sets session cookie on success", async () => {
    const res = await jsonReq("/api/setup/complete", {
      method: "POST",
      body: {
        email: "admin@example.com",
        password: "securepassword123",
        username: "admin",
        displayName: "Administrator",
      },
    });

    expect(res.status).toBe(201);
    const sessionCookie = getSessionCookie(res);
    expect(sessionCookie).toBeTruthy();

    const meRes = await jsonReq("/api/auth/me", { cookie: sessionCookie });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.username).toBe("admin");
  });

  test("optionally sets appName and logoIcon", async () => {
    const res = await jsonReq("/api/setup/complete", {
      method: "POST",
      body: {
        email: "admin@example.com",
        password: "securepassword123",
        username: "admin",
        displayName: "Administrator",
        appName: "My App",
        logoIcon: "Heart",
      },
    });

    expect(res.status).toBe(201);

    const settings = dbUtils.getAllSettings();
    expect(settings.appName).toBe("My App");
    expect(settings.logoIcon).toBe("Heart");
  });
});
