import { beforeEach, describe, expect, test } from "bun:test";
import crypto from "crypto";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/knitly-custom-ext-test-${testId}.db`;
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
  db.exec("DELETE FROM api_keys");
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
  db.exec("DELETE FROM poll_votes");
  db.exec("DELETE FROM poll_options");
  db.exec("DELETE FROM polls");
  db.exec("DELETE FROM posts");
  db.exec("DELETE FROM invites");
  db.exec("DELETE FROM password_reset_tokens");
  db.exec("DELETE FROM sessions");
  db.exec("DELETE FROM users");
  db.exec("DELETE FROM settings");
  db.exec("DELETE FROM sqlite_sequence");
}

async function jsonReq(path, { method = "GET", body, cookie, bearer } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = `${COOKIE_NAME}=${cookie}`;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return app.request(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

let adminId, adminSession;

async function seedAdmin() {
  const pw = await hashPassword("password123");
  adminId = dbUtils.createUser("admin@test.com", "admin", "Admin User", pw, "admin");
  adminSession = dbUtils.createSession(adminId).sessionId;
}

beforeEach(async () => {
  resetDb();
  clearRateLimitStore();
  await seedAdmin();
});

describe("Custom extensions - homelab", () => {
  test("GET /api/custom/homelab/services requires auth", async () => {
    const res = await jsonReq("/api/custom/homelab/services");
    expect(res.status).toBe(401);
  });

  test("GET /api/custom/homelab/services returns services when authenticated", async () => {
    const res = await jsonReq("/api/custom/homelab/services", { cookie: adminSession });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.services).toBeArray();
    expect(data.services.length).toBeGreaterThan(0);
    expect(data.services[0]).toHaveProperty("name");
    expect(data.services[0]).toHaveProperty("url");
    expect(data.services[0]).toHaveProperty("icon");
    expect(data.services[0]).toHaveProperty("description");
  });
});

describe("Custom extensions - AI chat", () => {
  test("POST /api/custom/ai-chat/completion requires auth", async () => {
    const res = await jsonReq("/api/custom/ai-chat/completion", {
      method: "POST",
      body: { messages: [{ role: "user", content: "hello" }] },
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/custom/ai-chat/completion validates messages", async () => {
    const res = await jsonReq("/api/custom/ai-chat/completion", {
      method: "POST",
      cookie: adminSession,
      body: {},
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("messages");
  });

  test("POST /api/custom/ai-chat/completion returns 503 without API key", async () => {
    const res = await jsonReq("/api/custom/ai-chat/completion", {
      method: "POST",
      cookie: adminSession,
      body: { messages: [{ role: "user", content: "hello" }] },
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("API key");
  });
});

describe("Custom extensions - image generation", () => {
  test("POST /api/custom/image-gen/generate requires auth", async () => {
    const res = await jsonReq("/api/custom/image-gen/generate", {
      method: "POST",
      body: { prompt: "a cat" },
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/custom/image-gen/generate validates prompt", async () => {
    const res = await jsonReq("/api/custom/image-gen/generate", {
      method: "POST",
      cookie: adminSession,
      body: {},
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("prompt");
  });

  test("POST /api/custom/image-gen/generate returns 503 without API key", async () => {
    const res = await jsonReq("/api/custom/image-gen/generate", {
      method: "POST",
      cookie: adminSession,
      body: { prompt: "a cat" },
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("API key");
  });

  test("GET /api/custom/image-gen/gallery requires auth", async () => {
    const res = await jsonReq("/api/custom/image-gen/gallery");
    expect(res.status).toBe(401);
  });

  test("GET /api/custom/image-gen/gallery returns empty array initially", async () => {
    const res = await jsonReq("/api/custom/image-gen/gallery", { cookie: adminSession });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.images).toBeArray();
    expect(data.images.length).toBe(0);
  });
});

describe("Custom extensions - route mounting", () => {
  test("custom routes are mounted under /api/custom", async () => {
    const homelabRes = await jsonReq("/api/custom/homelab/services");
    expect(homelabRes.status).toBe(401);

    const chatRes = await jsonReq("/api/custom/ai-chat/completion", { method: "POST", body: {} });
    expect(chatRes.status).toBe(401);

    const genRes = await jsonReq("/api/custom/image-gen/generate", { method: "POST", body: {} });
    expect(genRes.status).toBe(401);
  });

  test("core API routes still work alongside custom routes", async () => {
    const healthRes = await jsonReq("/api/health");
    expect(healthRes.status).toBe(200);
    const data = await healthRes.json();
    expect(data.status).toBe("ok");
  });
});
