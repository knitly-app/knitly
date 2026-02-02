import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "crypto";
import { Hono } from "hono";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/circles-test-${testId}.db`;
process.env.USE_LOCAL_STORAGE = "true";
process.env.LOCAL_UPLOAD_DIR = `/tmp/circles-uploads-${testId}`;
process.env.BASE_URL = "http://localhost:3000";

const { dbUtils, db } = await import("../src/lib/db.js");
const { hashPassword, verifyPassword } = await import("../src/lib/security.js");
const { ensureSession, optionalAuth, requireRole } = await import("../src/middleware/auth.js");
const { createApp } = await import("../src/app.js");
const { COOKIE_NAME } = await import("../src/lib/constants.js");

const app = createApp();

function resetDb() {
  db.exec("DELETE FROM notifications");
  db.exec("DELETE FROM comments");
  db.exec("DELETE FROM likes");
  db.exec("DELETE FROM post_media");
  db.exec("DELETE FROM follows");
  db.exec("DELETE FROM posts");
  db.exec("DELETE FROM invites");
  db.exec("DELETE FROM sessions");
  db.exec("DELETE FROM users");
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

async function seedTwoUsers() {
  const passwordHash = await hashPassword("password123");
  const userAId = dbUtils.createUser("alice@test.com", "alice", "Alice", passwordHash);
  const userBId = dbUtils.createUser("bob@test.com", "bob", "Bob", passwordHash);
  const { sessionId: sessionA } = dbUtils.createSession(userAId);
  const { sessionId: sessionB } = dbUtils.createSession(userBId);
  return { userAId, userBId, sessionA, sessionB };
}

beforeEach(() => {
  resetDb();
});

afterAll(() => {
  db.close();
});

describe("P0 unit", () => {
  test("users create/get/update", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("alice@test.com", "alice", "Alice", passwordHash);

    const byId = dbUtils.getUserById(userId);
    expect(byId.email).toBe("alice@test.com");
    expect(byId.username).toBe("alice");

    const byEmail = dbUtils.getUserByEmail("alice@test.com");
    expect(byEmail.id).toBe(userId);

    const byUsername = dbUtils.getUserByUsername("alice");
    expect(byUsername.id).toBe(userId);

    dbUtils.updateUser(userId, { displayName: "Alice 2", bio: "bio", avatar: "avatar" });
    const updated = dbUtils.getUserById(userId);
    expect(updated.display_name).toBe("Alice 2");
  });

  test("sessions create/get/expire", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("bob@test.com", "bob", "Bob", passwordHash);
    const { sessionId } = dbUtils.createSession(userId);

    const session = dbUtils.getSession(sessionId);
    expect(session.user_id).toBe(userId);

    db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(Date.now() - 1000, sessionId);
    const expired = dbUtils.getSession(sessionId);
    expect(expired).toBeNull();
  });

  test("posts create/get with media", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("carol@test.com", "carol", "Carol", passwordHash);

    const post = dbUtils.createPost(userId, "Hello", [
      { url: "http://example.com/a.jpg", width: 100, height: 200, type: "image", sortOrder: 1 },
    ]);

    const fetched = dbUtils.getPost(post.id);
    expect(fetched.content).toBe("Hello");
    expect(fetched.media.length).toBe(1);
  });

  test("feed cursor ordering", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("dana@test.com", "dana", "Dana", passwordHash);

    const postA = dbUtils.createPost(userId, "A");
    const postB = dbUtils.createPost(userId, "B");
    const postC = dbUtils.createPost(userId, "C");

    db.prepare("UPDATE posts SET created_at = ? WHERE id = ?").run("2024-01-01 10:00:00", postA.id);
    db.prepare("UPDATE posts SET created_at = ? WHERE id = ?").run("2024-01-01 11:00:00", postB.id);
    db.prepare("UPDATE posts SET created_at = ? WHERE id = ?").run("2024-01-01 12:00:00", postC.id);

    const first = dbUtils.getFeed(userId, 2);
    expect(first[0].content).toBe("C");
    expect(first[1].content).toBe("B");

    const page = dbUtils.getFeed(userId, 2, "2024-01-01 11:30:00");
    expect(page[0].content).toBe("B");
    expect(page[1].content).toBe("A");
  });

  test("security hash/verify", async () => {
    const hash = await hashPassword("password123");
    expect(await verifyPassword(hash, "password123")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  test("auth middleware", async () => {
    const passwordHash = await hashPassword("password123");
    const memberId = dbUtils.createUser("member@test.com", "member", "Member", passwordHash);
    const adminId = dbUtils.createUser("admin@test.com", "admin", "Admin", passwordHash, "admin");
    const { sessionId: memberSession } = dbUtils.createSession(memberId);
    const { sessionId: adminSession } = dbUtils.createSession(adminId);
    const { sessionId: expiredSession } = dbUtils.createSession(memberId);

    const mwApp = new Hono();
    mwApp.get("/optional", optionalAuth, (c) => c.json({ user: c.get("user") }));
    mwApp.get("/secure", ensureSession, (c) => c.json({ user: c.get("user") }));
    mwApp.get("/admin", ensureSession, requireRole("admin"), (c) => c.json({ ok: true }));

    const noCookie = await mwApp.request("/secure");
    expect(noCookie.status).toBe(401);

    db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(Date.now() - 1000, expiredSession);
    const expired = await mwApp.request("/secure", {
      headers: { Cookie: `${COOKIE_NAME}=${expiredSession}` },
    });
    expect(expired.status).toBe(401);

    const optional = await mwApp.request("/optional");
    const optionalBody = await optional.json();
    expect(optionalBody.user).toBeNull();

    const ok = await mwApp.request("/secure", {
      headers: { Cookie: `${COOKIE_NAME}=${adminSession}` },
    });
    expect(ok.status).toBe(200);

    const forbidden = await mwApp.request("/admin", {
      headers: { Cookie: `${COOKIE_NAME}=${memberSession}` },
    });
    expect(forbidden.status).toBe(403);

    const adminOk = await mwApp.request("/admin", {
      headers: { Cookie: `${COOKIE_NAME}=${adminSession}` },
    });
    expect(adminOk.status).toBe(200);
  });
});

describe("P1 unit", () => {
  test("like/unlike idempotent", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("like@test.com", "like", "Like", passwordHash);
    const post = dbUtils.createPost(userId, "Hello");

    dbUtils.likePost(userId, post.id);
    dbUtils.likePost(userId, post.id);

    const likeCount = db.prepare("SELECT COUNT(*) as count FROM likes WHERE user_id = ? AND post_id = ?")
      .get(userId, post.id).count;
    expect(likeCount).toBe(1);

    dbUtils.unlikePost(userId, post.id);
    dbUtils.unlikePost(userId, post.id);

    const afterCount = db.prepare("SELECT COUNT(*) as count FROM likes WHERE user_id = ? AND post_id = ?")
      .get(userId, post.id).count;
    expect(afterCount).toBe(0);
  });

  test("comments crud", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("comment@test.com", "comment", "Comment", passwordHash);
    const post = dbUtils.createPost(userId, "Hello");

    const comment = dbUtils.createComment(post.id, userId, "Nice");
    const fetched = dbUtils.getComment(comment.id);
    expect(fetched.content).toBe("Nice");

    const list = dbUtils.getComments(post.id);
    expect(list.length).toBe(1);

    dbUtils.deleteComment(comment.id);
    const after = dbUtils.getComments(post.id);
    expect(after.length).toBe(0);
  });

  test("follows counts and idempotent", async () => {
    const passwordHash = await hashPassword("password123");
    const a = dbUtils.createUser("a@test.com", "a", "A", passwordHash);
    const b = dbUtils.createUser("b@test.com", "b", "B", passwordHash);

    dbUtils.follow(a, b);
    dbUtils.follow(a, b);
    expect(dbUtils.isFollowing(a, b)).toBe(true);
    expect(dbUtils.getFollowerCount(b)).toBe(1);
    expect(dbUtils.getFollowingCount(a)).toBe(1);

    dbUtils.unfollow(a, b);
    dbUtils.unfollow(a, b);
    expect(dbUtils.isFollowing(a, b)).toBe(false);
  });

  test("notifications read", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("notify@test.com", "notify", "Notify", passwordHash);
    const actorId = dbUtils.createUser("actor@test.com", "actor", "Actor", passwordHash);
    const post = dbUtils.createPost(userId, "Hello");

    dbUtils.createNotification(userId, "like", actorId, post.id);
    const notifications = dbUtils.getNotifications(userId, 10);
    expect(notifications.length).toBe(1);

    const id = notifications[0].id;
    dbUtils.markNotificationRead(id, userId);
    const after = db.prepare("SELECT read FROM notifications WHERE id = ?").get(id).read;
    expect(after).toBe(1);

    dbUtils.createNotification(userId, "comment", actorId, post.id);
    dbUtils.markAllNotificationsRead(userId);
    const unread = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0")
      .get(userId).count;
    expect(unread).toBe(0);
  });

  test("invites create/mark", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("invite@test.com", "invite", "Invite", passwordHash);
    const usedBy = dbUtils.createUser("used@test.com", "used", "Used", passwordHash);

    const { token } = dbUtils.createInvite(userId);
    const invite = dbUtils.getInviteByToken(token);
    expect(invite.used).toBe(0);

    dbUtils.markInviteUsed(invite.id, usedBy);
    const updated = dbUtils.getInviteByToken(token);
    expect(updated.used).toBe(1);
  });

  test("search users/posts", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("search@test.com", "searcher", "Search User", passwordHash);
    dbUtils.createPost(userId, "Hello World");

    const users = dbUtils.searchUsers("search", 20);
    expect(users.length).toBe(1);

    const posts = dbUtils.searchPosts("Hello", 20);
    expect(posts.length).toBe(1);
  });
});

describe("P0 integration", () => {
  test("health ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("signup/login/me/logout flow", async () => {
    const passwordHash = await hashPassword("password123");
    const inviterId = dbUtils.createUser("inviter@test.com", "inviter", "Inviter", passwordHash);
    const { token } = dbUtils.createInvite(inviterId);

    const signupRes = await jsonReq("/api/auth/signup", {
      method: "POST",
      body: {
        email: "first@test.com",
        password: "password123",
        username: "first",
        displayName: "First",
        inviteToken: token,
      },
    });
    expect(signupRes.status).toBe(201);
    const signupCookie = getSessionCookie(signupRes);
    expect(signupCookie).toBeTruthy();

    const loginRes = await jsonReq("/api/auth/login", {
      method: "POST",
      body: { email: "first@test.com", password: "password123" },
    });
    expect(loginRes.status).toBe(200);
    const loginCookie = getSessionCookie(loginRes);
    expect(loginCookie).toBeTruthy();

    const meRes = await jsonReq("/api/auth/me", { cookie: loginCookie });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.username).toBe("first");

    const logoutRes = await jsonReq("/api/auth/logout", { method: "POST", cookie: loginCookie });
    expect(logoutRes.status).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.success).toBe(true);
  });

  test("create/get/delete post and feed", async () => {
    const passwordHash = await hashPassword("password123");
    const userId = dbUtils.createUser("poster@test.com", "poster", "Poster", passwordHash);
    const { sessionId: cookie } = dbUtils.createSession(userId);

    const emptyRes = await jsonReq("/api/posts", {
      method: "POST",
      cookie,
      body: { content: "" },
    });
    expect(emptyRes.status).toBe(400);

    const postRes = await jsonReq("/api/posts", {
      method: "POST",
      cookie,
      body: { content: "Hello world" },
    });
    expect(postRes.status).toBe(201);
    const postBody = await postRes.json();

    const getRes = await jsonReq(`/api/posts/${postBody.id}`, { cookie });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.content).toBe("Hello world");

    const likeRes = await jsonReq(`/api/posts/${postBody.id}/like`, { method: "POST", cookie });
    expect(likeRes.status).toBe(200);

    const feedRes = await jsonReq("/api/feed", { cookie });
    expect(feedRes.status).toBe(200);
    const feedBody = await feedRes.json();
    expect(feedBody.posts.length).toBe(1);
    expect(feedBody.posts[0].liked).toBe(true);
    expect(feedBody.nextCursor).toBeUndefined();

    const delRes = await jsonReq(`/api/posts/${postBody.id}`, { method: "DELETE", cookie });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);
  });
});

describe("P1 integration", () => {
  test("users list/get/update/follow", async () => {
    const { userAId, userBId, sessionA, sessionB } = await seedTwoUsers();

    const listRes = await jsonReq("/api/users", { cookie: sessionA });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.length).toBe(2);

    const meRes = await jsonReq("/api/users/me", { cookie: sessionA });
    const meBody = await meRes.json();
    expect(meBody.id).toBe(String(userAId));
    expect(meBody.followers).toBe(0);
    expect(meBody.following).toBe(0);

    const patchRes = await jsonReq("/api/users/me", {
      method: "PATCH",
      cookie: sessionA,
      body: { displayName: "Alice 2" },
    });
    expect(patchRes.status).toBe(200);

    const forbidden = await jsonReq(`/api/users/${userAId}`, {
      method: "PATCH",
      cookie: sessionB,
      body: { displayName: "Nope" },
    });
    expect(forbidden.status).toBe(403);

    const followSelf = await jsonReq(`/api/users/${userAId}/follow`, { method: "POST", cookie: sessionA });
    expect(followSelf.status).toBe(400);

    const followRes = await jsonReq(`/api/users/${userBId}/follow`, { method: "POST", cookie: sessionA });
    expect(followRes.status).toBe(200);

    const getOther = await jsonReq(`/api/users/${userBId}`, { cookie: sessionA });
    const otherBody = await getOther.json();
    expect(otherBody.isFollowing).toBe(true);

    const followersRes = await jsonReq(`/api/users/${userBId}/followers`, { cookie: sessionA });
    const followers = await followersRes.json();
    expect(followers.length).toBe(1);

    const followingRes = await jsonReq(`/api/users/${userAId}/following`, { cookie: sessionA });
    const following = await followingRes.json();
    expect(following.length).toBe(1);

    const unfollowRes = await jsonReq(`/api/users/${userBId}/follow`, { method: "DELETE", cookie: sessionA });
    expect(unfollowRes.status).toBe(200);
  });

  test("user posts liked flag", async () => {
    const { userBId, sessionA } = await seedTwoUsers();
    const post = dbUtils.createPost(userBId, "Hello");

    const likeRes = await jsonReq(`/api/posts/${post.id}/like`, { method: "POST", cookie: sessionA });
    expect(likeRes.status).toBe(200);

    const postsRes = await jsonReq(`/api/users/${userBId}/posts`, { cookie: sessionA });
    const posts = await postsRes.json();
    expect(posts[0].liked).toBe(true);

    const postsAnon = await jsonReq(`/api/users/${userBId}/posts`);
    const postsAnonBody = await postsAnon.json();
    expect(postsAnonBody[0].liked).toBe(false);
  });

  test("like/unlike and notifications", async () => {
    const { userAId, sessionA, sessionB } = await seedTwoUsers();
    const post = dbUtils.createPost(userAId, "Hello");

    const likeRes = await jsonReq(`/api/posts/${post.id}/like`, { method: "POST", cookie: sessionB });
    expect(likeRes.status).toBe(200);

    const getRes = await jsonReq(`/api/posts/${post.id}`, { cookie: sessionB });
    const getBody = await getRes.json();
    expect(getBody.liked).toBe(true);

    const unlikeRes = await jsonReq(`/api/posts/${post.id}/like`, { method: "DELETE", cookie: sessionB });
    expect(unlikeRes.status).toBe(200);

    const getAfter = await jsonReq(`/api/posts/${post.id}`, { cookie: sessionB });
    const getAfterBody = await getAfter.json();
    expect(getAfterBody.liked).toBe(false);

    const notificationsRes = await jsonReq("/api/notifications", { cookie: sessionA });
    const notifications = await notificationsRes.json();
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("like");
  });

  test("comments create/delete and notifications", async () => {
    const { userAId, sessionA, sessionB } = await seedTwoUsers();
    const post = dbUtils.createPost(userAId, "Hello");

    const commentRes = await jsonReq(`/api/posts/${post.id}/comments`, {
      method: "POST",
      cookie: sessionB,
      body: { content: "Nice" },
    });
    expect(commentRes.status).toBe(201);
    const commentBody = await commentRes.json();

    const listRes = await jsonReq(`/api/posts/${post.id}/comments`, { cookie: sessionB });
    const listBody = await listRes.json();
    expect(listBody.length).toBe(1);

    const forbidden = await jsonReq(`/api/posts/${post.id}/comments/${commentBody.id}`, {
      method: "DELETE",
      cookie: sessionA,
    });
    expect(forbidden.status).toBe(403);

    const delRes = await jsonReq(`/api/posts/${post.id}/comments/${commentBody.id}`, {
      method: "DELETE",
      cookie: sessionB,
    });
    expect(delRes.status).toBe(200);

    const notificationsRes = await jsonReq("/api/notifications", { cookie: sessionA });
    const notifications = await notificationsRes.json();
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe("comment");
  });

  test("notifications mark read/all", async () => {
    const { userAId, sessionA, sessionB } = await seedTwoUsers();
    const post = dbUtils.createPost(userAId, "Hello");

    await jsonReq(`/api/posts/${post.id}/like`, { method: "POST", cookie: sessionB });
    await jsonReq(`/api/posts/${post.id}/comments`, {
      method: "POST",
      cookie: sessionB,
      body: { content: "Nice" },
    });

    const listRes = await jsonReq("/api/notifications", { cookie: sessionA });
    const listBody = await listRes.json();

    const markRes = await jsonReq(`/api/notifications/${listBody[0].id}/read`, {
      method: "PATCH",
      cookie: sessionA,
    });
    expect(markRes.status).toBe(200);

    const listRes2 = await jsonReq("/api/notifications", { cookie: sessionA });
    const listBody2 = await listRes2.json();
    const oneRead = listBody2.find((n) => n.id === listBody[0].id);
    expect(oneRead.read).toBe(true);

    const readAll = await jsonReq("/api/notifications/read-all", { method: "POST", cookie: sessionA });
    expect(readAll.status).toBe(200);

    const listRes3 = await jsonReq("/api/notifications", { cookie: sessionA });
    const listBody3 = await listRes3.json();
    expect(listBody3.every((n) => n.read === true)).toBe(true);
  });

  test("search users/posts", async () => {
    const { sessionA } = await seedTwoUsers();
    dbUtils.createPost(dbUtils.getUserByUsername("alice").id, "Hello Search");

    const missing = await jsonReq("/api/search/users", { cookie: sessionA });
    expect(missing.status).toBe(400);

    const usersRes = await jsonReq("/api/search/users?q=ali", { cookie: sessionA });
    const users = await usersRes.json();
    expect(users.length).toBe(1);

    const postsRes = await jsonReq("/api/search/posts?q=Hello", { cookie: sessionA });
    const posts = await postsRes.json();
    expect(posts.length).toBe(1);
    expect(posts[0].liked).toBe(false);
  });

  test("invites flow", async () => {
    const { sessionA } = await seedTwoUsers();

    const createRes = await jsonReq("/api/invites", { method: "POST", cookie: sessionA });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();

    const listRes = await jsonReq("/api/invites", { cookie: sessionA });
    const listBody = await listRes.json();
    expect(listBody.length).toBe(1);

    const tokenRes = await jsonReq(`/api/invites/${createBody.token}`);
    expect(tokenRes.status).toBe(200);

    const signupRes = await jsonReq("/api/auth/signup", {
      method: "POST",
      body: {
        email: "newuser@test.com",
        password: "password123",
        username: "newuser",
        displayName: "New User",
        inviteToken: createBody.token,
      },
    });
    expect(signupRes.status).toBe(201);

    const usedRes = await jsonReq(`/api/invites/${createBody.token}`);
    expect(usedRes.status).toBe(400);
  });
});
