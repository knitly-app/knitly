import { describe, it, expect, beforeAll } from "bun:test";
import crypto from "crypto";

const testId = crypto.randomUUID();
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = `/tmp/knitly-db-test-${testId}.db`;

const { dbUtils, db } = await import("./db.js");

// Snapshot of the public dbUtils interface. The point of splitting db.js into
// domain modules is to preserve this exact surface behind a facade — if a
// method goes missing or is renamed during the split, this test fails.
const EXPECTED_METHODS = [
  "getUserById", "getUserByEmail", "getUserByUsername", "createUser", "updateUser",
  "getAllUsers", "getAllUserIds", "createSession", "getSession", "disableUser",
  "enableUser", "updateUserRole", "deleteUser", "deleteSessionsByUser", "transferOwnership",
  "deleteSession", "createPost", "getPost", "getFeed", "deletePost", "updatePost",
  "getUserPosts", "addPostMedia", "getPostMediaMap", "attachMedia", "attachMediaAndReactions",
  "addReaction", "removeReaction", "getUserReaction", "getReactionCounts", "getReactionCountsMap",
  "getUserReactionsMap", "createComment", "getComment", "getComments", "deleteComment",
  "getModerationFeed", "follow", "unfollow", "isFollowing", "getFollowers", "getFollowing",
  "getFollowerCount", "getFollowingCount", "createNotification", "getNotifications",
  "markNotificationRead", "markAllNotificationsRead", "clearAllNotifications", "createInvite",
  "getInviteByToken", "listInvites", "markInviteUsed", "revokeInviteByToken", "searchUsers",
  "searchPosts", "getStats", "needsSetup", "createAuditEntry", "getAuditLog", "createCircle",
  "updateCircle", "deleteCircle", "getCircle", "getUserCircles", "addCircleMember",
  "removeCircleMember", "getCircleMembers", "getUserCircleMemberships", "isCircleMember",
  "setPostCircles", "getPostCircles", "getPostCirclesMap", "getPostCirclesWithDetails",
  "canUserViewPost", "getSetting", "setSetting", "getAllSettings", "setSettings",
  "getChatMessages", "createChatMessage", "getRecentChatMessage", "cleanupOldChatMessages",
  "updateChatPresence", "getChatOnlineUsers", "cleanupStalePresence", "removeChatPresence",
  "createPoll", "getPoll", "getUserPollVote", "votePoll", "createResetToken", "getResetToken",
  "deleteResetToken", "deleteResetTokensByUser", "updatePasswordHash", "createEmailChangeToken",
  "getEmailChangeToken", "deleteEmailChangeToken", "deleteEmailChangeTokensByUser",
  "updateUserEmail", "getAdminCount", "getPasswordHash", "createApiKey", "getApiKeyByHash",
  "updateApiKeyLastUsed", "getApiKeysByUser", "revokeApiKey", "revokeApiKeysByUser",
  "deleteApiKeysByUser", "getBots", "getCommentsSince", "isMediaUrlReferenced",
];

describe("dbUtils interface", () => {
  it("exposes every expected method", () => {
    for (const name of EXPECTED_METHODS) {
      expect(typeof dbUtils[name]).toBe("function");
    }
  });

  it("exposes a Database instance", () => {
    expect(typeof db.prepare).toBe("function");
  });
});

describe("dbUtils cross-domain wiring (smoke)", () => {
  let alice, bob, postId;

  beforeAll(() => {
    alice = dbUtils.createUser("alice@t.com", "alice", "Alice", "h", "admin");
    bob = dbUtils.createUser("bob@t.com", "bob", "Bob", "h", "member");
  });

  it("creates and reads a post", () => {
    const post = dbUtils.createPost(alice, "hello world");
    postId = post.id;
    expect(post.content).toBe("hello world");
    expect(dbUtils.getPost(postId).user_id).toBe(alice);
  });

  it("reactions round-trip", () => {
    dbUtils.addReaction(bob, postId, "love");
    expect(dbUtils.getReactionCounts(postId).love).toBe(1);
    expect(dbUtils.getUserReaction(bob, postId)).toBe("love");
    dbUtils.removeReaction(bob, postId);
    expect(dbUtils.getReactionCounts(postId).love ?? 0).toBe(0);
  });

  it("comments round-trip", () => {
    const c = dbUtils.createComment(postId, bob, "nice");
    expect(c.content).toBe("nice");
    expect(dbUtils.getComments(postId).length).toBe(1);
  });

  it("follows round-trip", () => {
    dbUtils.follow(bob, alice);
    expect(dbUtils.isFollowing(bob, alice)).toBe(true);
    expect(dbUtils.getFollowerCount(alice)).toBe(1);
  });

  it("notifications use cross-domain canUserViewPost", () => {
    dbUtils.createNotification(alice, "comment", bob, postId);
    const notifs = dbUtils.getNotifications(alice);
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  it("circles gate post visibility", () => {
    const circle = dbUtils.createCircle(alice, "Friends", "blue");
    dbUtils.setPostCircles(postId, [circle.id]);
    expect(dbUtils.canUserViewPost(alice, postId)).toBe(true); // owner
    expect(dbUtils.canUserViewPost(bob, postId)).toBe(false); // not a member
    dbUtils.addCircleMember(circle.id, bob);
    expect(dbUtils.canUserViewPost(bob, postId)).toBe(true);
  });

  it("polls round-trip", () => {
    const post = dbUtils.createPost(alice, "poll post");
    dbUtils.createPoll(post.id, "Best?", ["A", "B"]);
    const poll = dbUtils.getPoll(post.id);
    expect(poll.options.length).toBe(2);
    dbUtils.votePoll(bob, poll.id, poll.options[0].id);
    expect(dbUtils.getUserPollVote(bob, poll.id)).toBe(poll.options[0].id);
  });

  it("settings round-trip via this.getSetting", () => {
    dbUtils.setSetting("appName", "TestApp");
    expect(dbUtils.getSetting("appName")).toBe("TestApp");
    expect(dbUtils.getAllSettings().appName).toBe("TestApp");
  });
});
