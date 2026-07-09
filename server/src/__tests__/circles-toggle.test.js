import { beforeEach, describe, expect, test } from "bun:test";
import crypto from "crypto";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/knitly-circles-toggle-test-${testId}.db`;
process.env.USE_LOCAL_STORAGE = "true";
process.env.LOCAL_UPLOAD_DIR = `/tmp/knitly-uploads-${testId}`;
process.env.BASE_URL = "http://localhost:3000";

const { dbUtils, db } = await import("../lib/db.js");
const { createApp } = await import("../app.js");
const { COOKIE_NAME } = await import("../lib/constants.js");
const { clearRateLimitStore } = await import("../middleware/rateLimit.js");
const { hashPassword } = await import("../lib/security.js");

const app = await createApp();

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

let adminId, authorId, viewerId, adminSession, authorSession, viewerSession;

async function seedUsers() {
  const pw = await hashPassword("password123");
  adminId = dbUtils.createUser("admin@test.com", "admin", "Admin User", pw, "admin");
  authorId = dbUtils.createUser("author@test.com", "author", "Author User", pw, "member");
  viewerId = dbUtils.createUser("viewer@test.com", "viewer", "Viewer User", pw, "member");
  adminSession = dbUtils.createSession(adminId).sessionId;
  authorSession = dbUtils.createSession(authorId).sessionId;
  viewerSession = dbUtils.createSession(viewerId).sessionId;
}

beforeEach(async () => {
  resetDb();
  clearRateLimitStore();
  await seedUsers();
});

describe("Settings API - circlesEnabled", () => {
  test("defaults to true", async () => {
    const res = await jsonReq("/api/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.circlesEnabled).toBe(true);
  });

  test("admin can disable and re-enable circles", async () => {
    let res = await jsonReq("/api/settings", {
      method: "PUT",
      body: { circlesEnabled: false },
      cookie: adminSession,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).circlesEnabled).toBe(false);

    res = await jsonReq("/api/settings");
    expect((await res.json()).circlesEnabled).toBe(false);

    res = await jsonReq("/api/settings", {
      method: "PUT",
      body: { circlesEnabled: true },
      cookie: adminSession,
    });
    expect((await res.json()).circlesEnabled).toBe(true);
  });

  test("rejects non-boolean circlesEnabled", async () => {
    const res = await jsonReq("/api/settings", {
      method: "PUT",
      body: { circlesEnabled: "false" },
      cookie: adminSession,
    });
    expect(res.status).toBe(400);
  });
});

describe("Post creation with circles disabled", () => {
  test("circleIds are attached when circles are enabled", async () => {
    const circle = dbUtils.createCircle(authorId, "Family");
    const res = await jsonReq("/api/posts", {
      method: "POST",
      body: { content: "scoped post", circleIds: [circle.id] },
      cookie: authorSession,
    });
    expect(res.status).toBe(201);
    const post = await res.json();
    expect(dbUtils.getPostCircles(post.id).length).toBe(1);
  });

  test("circleIds are ignored when circles are disabled", async () => {
    dbUtils.setSettings({ circlesEnabled: false });
    const circle = dbUtils.createCircle(authorId, "Family");
    const res = await jsonReq("/api/posts", {
      method: "POST",
      body: { content: "public post", circleIds: [circle.id] },
      cookie: authorSession,
    });
    expect(res.status).toBe(201);
    const post = await res.json();
    expect(dbUtils.getPostCircles(post.id).length).toBe(0);

    const viewRes = await jsonReq(`/api/posts/${post.id}`, { cookie: viewerSession });
    expect(viewRes.status).toBe(200);
  });

  test("existing circle-scoped posts keep their audience after disabling", async () => {
    const circle = dbUtils.createCircle(authorId, "Family");
    const createRes = await jsonReq("/api/posts", {
      method: "POST",
      body: { content: "scoped post", circleIds: [circle.id] },
      cookie: authorSession,
    });
    const post = await createRes.json();

    dbUtils.setSettings({ circlesEnabled: false });

    const viewerRes = await jsonReq(`/api/posts/${post.id}`, { cookie: viewerSession });
    expect(viewerRes.status).toBe(404);

    dbUtils.addCircleMember(circle.id, viewerId);
    const memberRes = await jsonReq(`/api/posts/${post.id}`, { cookie: viewerSession });
    expect(memberRes.status).toBe(200);
  });
});
