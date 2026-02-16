import { beforeEach, describe, expect, test } from "bun:test";
import crypto from "crypto";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/knitly-agent-api-test-${testId}.db`;
process.env.USE_LOCAL_STORAGE = "true";
process.env.LOCAL_UPLOAD_DIR = `/tmp/knitly-uploads-${testId}`;
process.env.BASE_URL = "http://localhost:3000";

const { dbUtils, db } = await import("../lib/db.js");
const { createApp } = await import("../app.js");
const { COOKIE_NAME } = await import("../lib/constants.js");
const { clearRateLimitStore } = await import("../middleware/rateLimit.js");
const { hashPassword } = await import("../lib/security.js");
const { generateRandomToken } = await import("../lib/security.js");

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

function createRawApiKey(userId, label = "default") {
  const rawKey = `knitly_${generateRandomToken(32)}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  dbUtils.createApiKey(userId, keyHash, label);
  return rawKey;
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

// --- Bearer Token Auth ---

describe("Bearer token authentication", () => {
  test("valid API key authenticates and returns data", async () => {
    const botId = dbUtils.createUser("bot@bot.knitly.local", "testbot", "Test Bot", null, "bot");
    const rawKey = createRawApiKey(botId);

    const res = await jsonReq("/api/feed", { bearer: rawKey });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toBeDefined();
  });

  test("invalid API key returns 401", async () => {
    const res = await jsonReq("/api/feed", { bearer: "knitly_boguskey12345" });

    expect(res.status).toBe(401);
  });

  test("non-knitly prefixed bearer returns 401", async () => {
    const res = await jsonReq("/api/feed", { bearer: "some_random_token" });

    expect(res.status).toBe(401);
  });

  test("no auth at all returns 401", async () => {
    const res = await jsonReq("/api/feed");

    expect(res.status).toBe(401);
  });

  test("revoked API key returns 401", async () => {
    const botId = dbUtils.createUser("bot@bot.knitly.local", "testbot", "Test Bot", null, "bot");
    const rawKey = createRawApiKey(botId);

    dbUtils.revokeApiKeysByUser(botId);

    const res = await jsonReq("/api/feed", { bearer: rawKey });
    expect(res.status).toBe(401);
  });

  test("disabled bot account returns 403", async () => {
    const botId = dbUtils.createUser("bot@bot.knitly.local", "testbot", "Test Bot", null, "bot");
    const rawKey = createRawApiKey(botId);

    dbUtils.disableUser(botId);

    const res = await jsonReq("/api/feed", { bearer: rawKey });
    expect(res.status).toBe(403);
  });

  test("last_used_at is updated on API key use", async () => {
    const botId = dbUtils.createUser("bot@bot.knitly.local", "testbot", "Test Bot", null, "bot");
    const rawKey = createRawApiKey(botId);

    const keysBefore = dbUtils.getApiKeysByUser(botId);
    expect(keysBefore[0].last_used_at).toBeNull();

    await jsonReq("/api/feed", { bearer: rawKey });

    const keysAfter = dbUtils.getApiKeysByUser(botId);
    expect(keysAfter[0].last_used_at).not.toBeNull();
  });

  test("session cookie takes priority over bearer token", async () => {
    const botId = dbUtils.createUser("bot@bot.knitly.local", "testbot", "Test Bot", null, "bot");
    const rawKey = createRawApiKey(botId);

    const res = await jsonReq("/api/auth/me", { cookie: adminSession, bearer: rawKey });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe("admin");
  });
});

// --- Bot Login Block ---

describe("Bot login block", () => {
  test("bot cannot log in via login form", async () => {
    const pw = await hashPassword("botpassword");
    dbUtils.createUser("bot@bot.knitly.local", "loginbot", "Login Bot", pw, "bot");

    const res = await jsonReq("/api/auth/login", {
      method: "POST",
      body: { email: "bot@bot.knitly.local", password: "botpassword" },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Bot");
  });
});

// --- Bot can use endpoints ---

describe("Bot can use standard endpoints", () => {
  let botId, botKey;

  beforeEach(() => {
    botId = dbUtils.createUser("bot@bot.knitly.local", "testbot", "Test Bot", null, "bot");
    botKey = createRawApiKey(botId);
  });

  test("bot can create a post", async () => {
    const res = await jsonReq("/api/posts", {
      method: "POST",
      bearer: botKey,
      body: { content: "Hello from the bot!" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.content).toBe("Hello from the bot!");
    expect(body.author.role).toBe("bot");
  });

  test("bot can react to a post", async () => {
    const post = dbUtils.createPost(adminId, "Admin post");

    const res = await jsonReq(`/api/posts/${post.id}/reactions`, {
      method: "POST",
      bearer: botKey,
      body: { type: "love" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userReaction).toBe("love");
  });

  test("bot can comment on a post", async () => {
    const post = dbUtils.createPost(adminId, "Admin post");

    const res = await jsonReq(`/api/posts/${post.id}/comments`, {
      method: "POST",
      bearer: botKey,
      body: { content: "Bot comment here" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.content).toBe("Bot comment here");
    expect(body.role).toBe("bot");
  });
});

// --- Feed `since` param ---

describe("Feed since parameter", () => {
  test("since returns only posts with id > since", async () => {
    const post1 = dbUtils.createPost(adminId, "Post one");
    const post2 = dbUtils.createPost(adminId, "Post two");
    const post3 = dbUtils.createPost(adminId, "Post three");

    const res = await jsonReq(`/api/feed?since=${post1.id}`, { cookie: adminSession });

    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.posts.map(p => Number(p.id));
    expect(ids).not.toContain(post1.id);
    expect(ids).toContain(post2.id);
    expect(ids).toContain(post3.id);
  });

  test("since=0 returns all posts", async () => {
    dbUtils.createPost(adminId, "Post one");
    dbUtils.createPost(adminId, "Post two");

    const res = await jsonReq("/api/feed?since=0", { cookie: adminSession });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts.length).toBe(2);
  });

  test("feed without since still works (backwards compat)", async () => {
    dbUtils.createPost(adminId, "Post one");

    const res = await jsonReq("/api/feed", { cookie: adminSession });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts.length).toBe(1);
  });
});

// --- Comments `since` param ---

describe("Comments since parameter", () => {
  test("since returns only comments with id > since", async () => {
    const post = dbUtils.createPost(adminId, "A post");
    const c1 = dbUtils.createComment(post.id, adminId, "Comment one");
    const c2 = dbUtils.createComment(post.id, adminId, "Comment two");
    const c3 = dbUtils.createComment(post.id, adminId, "Comment three");

    const res = await jsonReq(`/api/posts/${post.id}/comments?since=${c1.id}`, {
      cookie: adminSession,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.map(c => Number(c.id));
    expect(ids).not.toContain(c1.id);
    expect(ids).toContain(c2.id);
    expect(ids).toContain(c3.id);
  });

  test("comments without since returns all (backwards compat)", async () => {
    const post = dbUtils.createPost(adminId, "A post");
    dbUtils.createComment(post.id, adminId, "Comment one");
    dbUtils.createComment(post.id, adminId, "Comment two");

    const res = await jsonReq(`/api/posts/${post.id}/comments`, {
      cookie: adminSession,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(2);
  });
});

// --- Author role in responses ---

describe("Role included in responses", () => {
  test("feed includes author.role for bot posts", async () => {
    const botId = dbUtils.createUser("bot@bot.knitly.local", "testbot", "Test Bot", null, "bot");
    dbUtils.createPost(botId, "Bot post");

    const res = await jsonReq("/api/feed", { cookie: adminSession });

    expect(res.status).toBe(200);
    const body = await res.json();
    const botPost = body.posts.find(p => p.content === "Bot post");
    expect(botPost.author.role).toBe("bot");
  });

  test("feed includes author.role for member posts", async () => {
    dbUtils.createPost(adminId, "Admin post");

    const res = await jsonReq("/api/feed", { cookie: adminSession });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts[0].author.role).toBe("admin");
  });

  test("comments include role field", async () => {
    const botId = dbUtils.createUser("bot@bot.knitly.local", "testbot", "Test Bot", null, "bot");
    const post = dbUtils.createPost(adminId, "A post");
    dbUtils.createComment(post.id, botId, "Bot comment");

    const res = await jsonReq(`/api/posts/${post.id}/comments`, { cookie: adminSession });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].role).toBe("bot");
  });
});

// --- Admin Bot Management ---

describe("Admin bot management - POST /api/admin/bots", () => {
  test("admin can create a bot", async () => {
    const res = await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "mybot", displayName: "My Bot", bio: "A friendly bot" },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.username).toBe("mybot");
    expect(body.displayName).toBe("My Bot");
    expect(body.apiKey).toStartWith("knitly_");
  });

  test("created bot appears in user list with role bot", async () => {
    await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "mybot", displayName: "My Bot" },
    });

    const bot = dbUtils.getUserByUsername("mybot");
    expect(bot).not.toBeNull();
    expect(bot.role).toBe("bot");
    expect(bot.password_hash).toBeNull();
  });

  test("cannot create bot with duplicate username", async () => {
    await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "mybot", displayName: "My Bot" },
    });

    const res = await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "mybot", displayName: "Another Bot" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Username");
  });

  test("cannot create bot with invalid username", async () => {
    const res = await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "my bot!", displayName: "Bad Bot" },
    });

    expect(res.status).toBe(400);
  });

  test("cannot create bot without username or displayName", async () => {
    const res = await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "", displayName: "" },
    });

    expect(res.status).toBe(400);
  });
});

describe("Admin bot management - GET /api/admin/bots", () => {
  test("lists all bots with their keys", async () => {
    await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "bot1", displayName: "Bot One" },
    });
    await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "bot2", displayName: "Bot Two" },
    });

    const res = await jsonReq("/api/admin/bots", { cookie: adminSession });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(2);
    expect(body[0].keys).toBeDefined();
    expect(body[0].keys.length).toBeGreaterThan(0);
  });

  test("does not list non-bot users", async () => {
    const res = await jsonReq("/api/admin/bots", { cookie: adminSession });

    expect(res.status).toBe(200);
    const body = await res.json();
    const adminBot = body.find(b => b.username === "admin");
    expect(adminBot).toBeUndefined();
  });
});

describe("Admin bot management - key operations", () => {
  let botId;

  beforeEach(async () => {
    const res = await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "keybot", displayName: "Key Bot" },
    });
    botId = (await res.json()).id;
  });

  test("regenerate key returns new key and revokes old", async () => {
    const res = await jsonReq(`/api/admin/bots/${botId}/regenerate-key`, {
      method: "POST",
      cookie: adminSession,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKey).toStartWith("knitly_");

    const keys = dbUtils.getApiKeysByUser(Number(botId));
    const revokedKeys = keys.filter(k => k.revoked_at);
    const activeKeys = keys.filter(k => !k.revoked_at);
    expect(revokedKeys.length).toBe(1);
    expect(activeKeys.length).toBe(1);
  });

  test("revoke key disables API access", async () => {
    const botsRes = await jsonReq("/api/admin/bots", { cookie: adminSession });
    const bots = await botsRes.json();
    const bot = bots.find(b => b.id === botId);
    expect(bot.keys.filter(k => !k.revokedAt).length).toBe(1);

    await jsonReq(`/api/admin/bots/${botId}/revoke-key`, {
      method: "POST",
      cookie: adminSession,
    });

    const botsAfter = await (await jsonReq("/api/admin/bots", { cookie: adminSession })).json();
    const botAfter = botsAfter.find(b => b.id === botId);
    expect(botAfter.keys.filter(k => !k.revokedAt).length).toBe(0);
  });

  test("regenerate on non-bot user returns 404", async () => {
    const res = await jsonReq(`/api/admin/bots/${adminId}/regenerate-key`, {
      method: "POST",
      cookie: adminSession,
    });

    expect(res.status).toBe(404);
  });
});

describe("Admin bot management - DELETE /api/admin/bots/:id", () => {
  test("deleting a bot removes user and keys", async () => {
    const createRes = await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: adminSession,
      body: { username: "deletebot", displayName: "Delete Bot" },
    });
    const { id } = await createRes.json();

    const res = await jsonReq(`/api/admin/bots/${id}`, {
      method: "DELETE",
      cookie: adminSession,
    });

    expect(res.status).toBe(200);

    const user = dbUtils.getUserByUsername("deletebot");
    expect(user).toBeNull();
  });

  test("cannot delete a non-bot user via bot endpoint", async () => {
    const res = await jsonReq(`/api/admin/bots/${adminId}`, {
      method: "DELETE",
      cookie: adminSession,
    });

    expect(res.status).toBe(404);
  });
});

// --- Admin-only access ---

describe("Bot management requires admin role", () => {
  let memberSession;

  beforeEach(async () => {
    const pw = await hashPassword("password123");
    const memberId = dbUtils.createUser("member@test.com", "member", "Member User", pw, "member");
    memberSession = dbUtils.createSession(memberId).sessionId;
  });

  test("member cannot list bots", async () => {
    const res = await jsonReq("/api/admin/bots", { cookie: memberSession });
    expect(res.status).toBe(403);
  });

  test("member cannot create bots", async () => {
    const res = await jsonReq("/api/admin/bots", {
      method: "POST",
      cookie: memberSession,
      body: { username: "hackerbot", displayName: "Hacker Bot" },
    });
    expect(res.status).toBe(403);
  });
});
