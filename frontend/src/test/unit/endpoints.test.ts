import { describe, it, expect, afterEach } from "bun:test";
import { users, posts, search, invites, media, admin, chat, setup } from "../../api/endpoints";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

describe("users endpoints", () => {
  it("get fetches a single user by id", async () => {
    fetchMock = mockFetch({ id: "1", username: "a", displayName: "A", createdAt: "" });
    await users.get("1");
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/users/1", method: "GET" });
  });

  it("update patches user fields", async () => {
    fetchMock = mockFetch({ id: "1", username: "a", displayName: "B", createdAt: "" });
    await users.update("1", { displayName: "B" });
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("/api/users/1");
    expect(call.method).toBe("PATCH");
    expect(call.body).toMatchObject({ displayName: "B" });
  });

  it("followers lists followers", async () => {
    fetchMock = mockFetch([]);
    await users.followers("1");
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/users/1/followers", method: "GET" });
  });

  it("following lists following", async () => {
    fetchMock = mockFetch([]);
    await users.following("1");
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/users/1/following", method: "GET" });
  });

  it("list fetches all users", async () => {
    fetchMock = mockFetch([]);
    await users.list();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/users", method: "GET" });
  });
});

describe("posts endpoints", () => {
  it("feed with cursor builds query string", async () => {
    fetchMock = mockFetch({ posts: [] });
    await posts.feed("cur1");
    expect(fetchMock.lastCall()!.url).toBe("/api/feed?cursor=cur1");
  });

  it("feed with cursor and circleId includes both params", async () => {
    fetchMock = mockFetch({ posts: [] });
    await posts.feed("cur1", "circle42");
    expect(fetchMock.lastCall()!.url).toBe("/api/feed?cursor=cur1&circleId=circle42");
  });
});

describe("search endpoints", () => {
  it("users searches with query param", async () => {
    fetchMock = mockFetch([]);
    await search.users("alice");
    expect(fetchMock.lastCall()!.url).toBe("/api/search/users?q=alice");
  });

  it("posts searches with query param", async () => {
    fetchMock = mockFetch([]);
    await search.posts("hello");
    expect(fetchMock.lastCall()!.url).toBe("/api/search/posts?q=hello");
  });
});

describe("invites endpoints", () => {
  it("validate checks an invite token", async () => {
    fetchMock = mockFetch({ valid: true });
    await invites.validate("tok1");
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/invites/tok1", method: "GET" });
  });

  it("create posts to create a new invite", async () => {
    fetchMock = mockFetch({ token: "tok1", expiresAt: "" });
    await invites.create();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/invites", method: "POST" });
  });

  it("list fetches all invites", async () => {
    fetchMock = mockFetch([]);
    await invites.list();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/invites", method: "GET" });
  });

  it("revoke posts to revoke an invite", async () => {
    fetchMock = mockFetch({ token: "tok1", revokedAt: "" });
    await invites.revoke("tok1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/invites/tok1/revoke",
      method: "POST",
    });
  });
});

describe("media endpoints", () => {
  it("presign requests an upload url", async () => {
    fetchMock = mockFetch({ uploadUrl: "https://s3.example.com/up", key: "k1", expiresIn: 300 });
    await media.presign({ contentType: "image/png", size: 1024 });
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("/api/media/presign");
    expect(call.method).toBe("POST");
    expect(call.body).toMatchObject({ contentType: "image/png", size: 1024 });
  });

  it("complete finalizes an upload", async () => {
    fetchMock = mockFetch({ url: "https://cdn.example.com/img.png", type: "image" });
    await media.complete({ key: "k1" });
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("/api/media/complete");
    expect(call.method).toBe("POST");
    expect(call.body).toMatchObject({ key: "k1" });
  });
});

describe("admin endpoints", () => {
  it("users fetches all users", async () => {
    fetchMock = mockFetch([]);
    await admin.users();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/admin/users", method: "GET" });
  });

  it("stats fetches site stats", async () => {
    fetchMock = mockFetch({ users: 10, posts: 50, invites: 5 });
    await admin.stats();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/admin/stats", method: "GET" });
  });

  it("content without params omits query string", async () => {
    fetchMock = mockFetch({ items: [] });
    await admin.content();
    expect(fetchMock.lastCall()!.url).toBe("/api/admin/content?");
  });

  it("content with cursor only appends cursor param", async () => {
    fetchMock = mockFetch({ items: [] });
    await admin.content({ cursor: "c1" });
    expect(fetchMock.lastCall()!.url).toBe("/api/admin/content?cursor=c1");
  });

  it("content with q only appends q param", async () => {
    fetchMock = mockFetch({ items: [] });
    await admin.content({ q: "spam" });
    expect(fetchMock.lastCall()!.url).toBe("/api/admin/content?q=spam");
  });

  it("content with both cursor and q appends both params", async () => {
    fetchMock = mockFetch({ items: [] });
    await admin.content({ cursor: "c1", q: "spam" });
    expect(fetchMock.lastCall()!.url).toBe("/api/admin/content?cursor=c1&q=spam");
  });

  it("deleteContent posts to delete endpoint with type", async () => {
    fetchMock = mockFetch({ success: true, type: "post", id: "p1" });
    await admin.deleteContent("p1", "post");
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("/api/admin/content/p1/delete");
    expect(call.method).toBe("POST");
    expect(call.body).toMatchObject({ type: "post" });
  });

  it("disableUser posts to disable endpoint", async () => {
    fetchMock = mockFetch({ id: "u1", disabledAt: "2024-01-01" });
    await admin.disableUser("u1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/users/u1/disable",
      method: "POST",
    });
  });

  it("enableUser posts to enable endpoint", async () => {
    fetchMock = mockFetch({ id: "u1", disabledAt: null });
    await admin.enableUser("u1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/users/u1/enable",
      method: "POST",
    });
  });

  it("promoteUser posts to promote endpoint", async () => {
    fetchMock = mockFetch({ id: "u1", role: "moderator" });
    await admin.promoteUser("u1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/users/u1/promote",
      method: "POST",
    });
  });

  it("demoteUser posts to demote endpoint", async () => {
    fetchMock = mockFetch({ id: "u1", role: "member" });
    await admin.demoteUser("u1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/users/u1/demote",
      method: "POST",
    });
  });

  it("transferOwnership posts to transfer endpoint", async () => {
    fetchMock = mockFetch({ id: "u1", role: "admin" });
    await admin.transferOwnership("u1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/users/u1/transfer",
      method: "POST",
    });
  });

  it("removeUser deletes a user", async () => {
    fetchMock = mockFetch({ success: true });
    await admin.removeUser("u1");
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/admin/users/u1", method: "DELETE" });
  });

  it("auditLog without params omits query string", async () => {
    fetchMock = mockFetch({ items: [] });
    await admin.auditLog();
    expect(fetchMock.lastCall()!.url).toBe("/api/admin/audit?");
  });

  it("auditLog with cursor appends cursor param", async () => {
    fetchMock = mockFetch({ items: [] });
    await admin.auditLog({ cursor: "c1" });
    expect(fetchMock.lastCall()!.url).toBe("/api/admin/audit?cursor=c1");
  });

  it("auditLog with limit appends limit param", async () => {
    fetchMock = mockFetch({ items: [] });
    await admin.auditLog({ limit: 25 });
    expect(fetchMock.lastCall()!.url).toBe("/api/admin/audit?limit=25");
  });

  it("auditLog with cursor and limit appends both params", async () => {
    fetchMock = mockFetch({ items: [] });
    await admin.auditLog({ cursor: "c1", limit: 25 });
    expect(fetchMock.lastCall()!.url).toBe("/api/admin/audit?cursor=c1&limit=25");
  });

  it("revokeUserSessions posts to revoke-sessions endpoint", async () => {
    fetchMock = mockFetch({ success: true, id: "u1" });
    await admin.revokeUserSessions("u1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/users/u1/revoke-sessions",
      method: "POST",
    });
  });

  it("resetPassword posts to reset-password endpoint", async () => {
    fetchMock = mockFetch({ token: "tok1", expiresAt: "" });
    await admin.resetPassword("u1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/users/u1/reset-password",
      method: "POST",
    });
  });

  it("bots fetches all bots", async () => {
    fetchMock = mockFetch([]);
    await admin.bots();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/admin/bots", method: "GET" });
  });

  it("createBot posts a new bot", async () => {
    fetchMock = mockFetch({
      id: "b1",
      username: "bot",
      displayName: "Bot",
      bio: "",
      apiKey: "key",
    });
    await admin.createBot({ username: "bot", displayName: "Bot" });
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("/api/admin/bots");
    expect(call.method).toBe("POST");
    expect(call.body).toMatchObject({ username: "bot", displayName: "Bot" });
  });

  it("regenerateBotKey posts to regenerate-key endpoint", async () => {
    fetchMock = mockFetch({ apiKey: "newkey" });
    await admin.regenerateBotKey("b1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/bots/b1/regenerate-key",
      method: "POST",
    });
  });

  it("revokeBotKey posts to revoke-key endpoint", async () => {
    fetchMock = mockFetch({ success: true });
    await admin.revokeBotKey("b1");
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/admin/bots/b1/revoke-key",
      method: "POST",
    });
  });

  it("deleteBot deletes a bot", async () => {
    fetchMock = mockFetch({ success: true });
    await admin.deleteBot("b1");
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/admin/bots/b1", method: "DELETE" });
  });
});

describe("chat endpoints", () => {
  it("messages without since omits query string", async () => {
    fetchMock = mockFetch({ messages: [] });
    await chat.messages();
    expect(fetchMock.lastCall()!.url).toBe("/api/chat/messages?");
  });

  it("messages with since appends since param", async () => {
    fetchMock = mockFetch({ messages: [] });
    await chat.messages("2024-01-01T00:00:00Z");
    expect(fetchMock.lastCall()!.url).toBe("/api/chat/messages?since=2024-01-01T00%3A00%3A00Z");
  });

  it("presence posts to presence endpoint", async () => {
    fetchMock = mockFetch({ online: 1, users: [], joins: [], leaves: [] });
    await chat.presence();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/chat/presence", method: "POST" });
  });

  it("leave posts to leave endpoint", async () => {
    fetchMock = mockFetch({});
    await chat.leave();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/chat/leave", method: "POST" });
  });
});

describe("setup endpoints", () => {
  it("status checks if setup is needed", async () => {
    fetchMock = mockFetch({ needsSetup: true });
    await setup.status();
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/setup/status", method: "GET" });
  });

  it("complete posts initial setup data", async () => {
    fetchMock = mockFetch({ user: { id: "u1" }, success: true });
    await setup.complete({
      email: "admin@example.com",
      password: "secret",
      username: "admin",
      displayName: "Admin",
    });
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("/api/setup/complete");
    expect(call.method).toBe("POST");
    expect(call.body).toMatchObject({ email: "admin@example.com", username: "admin" });
  });
});
