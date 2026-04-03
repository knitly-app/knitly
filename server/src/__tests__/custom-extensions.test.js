import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/knitly-custom-ext-test-${testId}.db`;
process.env.USE_LOCAL_STORAGE = "true";
process.env.LOCAL_UPLOAD_DIR = `/tmp/knitly-uploads-${testId}`;
process.env.BASE_URL = "http://localhost:3000";
process.env.ANTHROPIC_API_KEY = "";
process.env.REPLICATE_API_KEY = "";

const { dbUtils, db } = await import("../lib/db.js");
const { createApp } = await import("../app.js");
const { COOKIE_NAME } = await import("../lib/constants.js");
const { clearRateLimitStore } = await import("../middleware/rateLimit.js");
const { hashPassword } = await import("../lib/security.js");

const app = await createApp();
const GENERATED_DIR = path.resolve("..", "uploads", "generated");

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

async function resetGeneratedImagesDir() {
  await fs.rm(GENERATED_DIR, { recursive: true, force: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });
}

beforeEach(async () => {
  resetDb();
  clearRateLimitStore();
  await resetGeneratedImagesDir();
  await seedAdmin();
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
    expect(data.error).toContain("Anthropic");
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

  test("GET /api/custom/image-gen/gallery includes videos and images", async () => {
    const imageFile = `gallery-image-${crypto.randomUUID()}.webp`;
    const videoFile = `gallery-video-${crypto.randomUUID()}.mp4`;

    await fs.mkdir(GENERATED_DIR, { recursive: true });
    await fs.writeFile(path.join(GENERATED_DIR, imageFile), "fake-image-data");
    await fs.writeFile(path.join(GENERATED_DIR, videoFile), "fake-video-data");

    const res = await jsonReq("/api/custom/image-gen/gallery", { cookie: adminSession });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filename: imageFile, type: "image" }),
        expect.objectContaining({ filename: videoFile, type: "video" }),
      ]),
    );
  });
});

describe("Custom extensions - video generation", () => {
  test("POST /api/custom/image-gen/generate-video requires auth", async () => {
    const res = await jsonReq("/api/custom/image-gen/generate-video", {
      method: "POST",
      body: { prompt: "a cat video" },
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/custom/image-gen/generate-video validates prompt", async () => {
    const res = await jsonReq("/api/custom/image-gen/generate-video", {
      method: "POST",
      cookie: adminSession,
      body: {},
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("prompt");
  });

  test("POST /api/custom/image-gen/generate-video returns 503 without API key", async () => {
    const res = await jsonReq("/api/custom/image-gen/generate-video", {
      method: "POST",
      cookie: adminSession,
      body: { prompt: "a cat video" },
    });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("API key");
  });

  test("POST /api/custom/image-gen/generate-video validates aspect ratio", async () => {
    const res = await jsonReq("/api/custom/image-gen/generate-video", {
      method: "POST",
      cookie: adminSession,
      body: { prompt: "a cat video", aspectRatio: "4:3" },
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid aspect ratio");
  });

  test("GET /api/custom/image-gen/video-status/:id requires auth", async () => {
    const res = await jsonReq("/api/custom/image-gen/video-status/test-id");
    expect(res.status).toBe(401);
  });
});

describe("Custom extensions - route mounting", () => {
  test("custom routes are mounted under /api/custom", async () => {
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

describe("isMediaUrlReferenced", () => {
  test("returns false when no posts reference the URL", () => {
    expect(dbUtils.isMediaUrlReferenced("nonexistent-image.webp")).toBe(false);
  });

  test("returns true when a post references the URL", () => {
    const postId = dbUtils.createPost(adminId, "test post", [
      { url: "/uploads/generated/test-image-abc.webp", type: "image" },
    ]).id;
    expect(postId).toBeTruthy();
    expect(dbUtils.isMediaUrlReferenced("test-image-abc.webp")).toBe(true);
  });

  test("returns false after the referencing post is deleted", () => {
    const postId = dbUtils.createPost(adminId, "temp post", [
      { url: "/uploads/generated/temp-image.webp", type: "image" },
    ]).id;
    expect(dbUtils.isMediaUrlReferenced("temp-image.webp")).toBe(true);

    db.prepare("DELETE FROM post_media WHERE post_id = ?").run(postId);
    expect(dbUtils.isMediaUrlReferenced("temp-image.webp")).toBe(false);
  });
});

describe("Generated media cleanup", () => {
  const testGenDir = `/tmp/knitly-gen-cleanup-${testId}`;

  async function writeTestMedia(filename, ageMs = 0) {
    await fs.mkdir(testGenDir, { recursive: true });
    const filepath = path.join(testGenDir, filename);
    await fs.writeFile(filepath, "fake-image-data");
    if (ageMs > 0) {
      const past = new Date(Date.now() - ageMs);
      await fs.utimes(filepath, past, past);
    }
    return filepath;
  }

  test("cleanup endpoint requires admin", async () => {
    const pw = await hashPassword("password123");
    const memberId = dbUtils.createUser(`member-${crypto.randomUUID()}@test.com`, `member-${crypto.randomUUID().slice(0, 8)}`, "Member", pw, "member");
    const memberSession = dbUtils.createSession(memberId).sessionId;

    const res = await jsonReq("/api/custom/image-gen/cleanup", { cookie: memberSession });
    expect(res.status).toBe(403);
  });

  test("cleanup deletes old unreferenced images", async () => {
    const { cleanupGeneratedMedia } = await import("../../../custom/server/image-gen/routes.js");

    const oldFile = "old-unreferenced.webp";
    await writeTestMedia(oldFile, 25 * 60 * 60 * 1000);

    const origDir = GENERATED_DIR;

    await fs.mkdir(origDir, { recursive: true });
    await fs.copyFile(path.join(testGenDir, oldFile), path.join(origDir, oldFile));
    const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await fs.utimes(path.join(origDir, oldFile), pastTime, pastTime);

    const result = await cleanupGeneratedMedia();
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    const exists = await fs.access(path.join(origDir, oldFile)).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  test("cleanup keeps referenced images", async () => {
    const { cleanupGeneratedMedia } = await import("../../../custom/server/image-gen/routes.js");

    const refFile = `referenced-${crypto.randomUUID()}.webp`;
    const origDir = GENERATED_DIR;
    await fs.mkdir(origDir, { recursive: true });
    await fs.writeFile(path.join(origDir, refFile), "fake-image");
    const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await fs.utimes(path.join(origDir, refFile), pastTime, pastTime);

    dbUtils.createPost(adminId, "post with image", [
      { url: `/uploads/generated/${refFile}`, type: "image" },
    ]);

    await cleanupGeneratedMedia();

    const exists = await fs.access(path.join(origDir, refFile)).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    await fs.unlink(path.join(origDir, refFile)).catch(() => {});
  });

  test("cleanup keeps images younger than 24h", async () => {
    const { cleanupGeneratedMedia } = await import("../../../custom/server/image-gen/routes.js");

    const newFile = `new-${crypto.randomUUID()}.webp`;
    const origDir = GENERATED_DIR;
    await fs.mkdir(origDir, { recursive: true });
    await fs.writeFile(path.join(origDir, newFile), "fake-image");

    await cleanupGeneratedMedia();

    const exists = await fs.access(path.join(origDir, newFile)).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    await fs.unlink(path.join(origDir, newFile)).catch(() => {});
  });

  test("cleanup deletes old unreferenced videos", async () => {
    const { cleanupGeneratedMedia } = await import("../../../custom/server/image-gen/routes.js");

    const oldVideo = `old-unreferenced-${crypto.randomUUID()}.mp4`;
    const origDir = GENERATED_DIR;
    await fs.mkdir(origDir, { recursive: true });
    await fs.writeFile(path.join(origDir, oldVideo), "fake-video");
    const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await fs.utimes(path.join(origDir, oldVideo), pastTime, pastTime);

    const result = await cleanupGeneratedMedia();
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    const exists = await fs.access(path.join(origDir, oldVideo)).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  test("cleanup keeps referenced videos", async () => {
    const { cleanupGeneratedMedia } = await import("../../../custom/server/image-gen/routes.js");

    const refVideo = `referenced-${crypto.randomUUID()}.mp4`;
    const origDir = GENERATED_DIR;
    await fs.mkdir(origDir, { recursive: true });
    await fs.writeFile(path.join(origDir, refVideo), "fake-video");
    const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await fs.utimes(path.join(origDir, refVideo), pastTime, pastTime);

    dbUtils.createPost(adminId, "post with video", [
      { url: `/uploads/generated/${refVideo}`, type: "video" },
    ]);

    await cleanupGeneratedMedia();

    const exists = await fs.access(path.join(origDir, refVideo)).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    await fs.unlink(path.join(origDir, refVideo)).catch(() => {});
  });

  afterAll(async () => {
    await fs.rm(testGenDir, { recursive: true, force: true }).catch(() => {});
  });
});
