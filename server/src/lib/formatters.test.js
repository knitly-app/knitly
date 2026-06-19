import { describe, it, expect } from "bun:test";
import {
  formatUser,
  formatUserProfile,
  formatAdminUser,
  formatComment,
  formatPoll,
  formatPost,
} from "./formatters.js";

const baseUserRow = {
  id: 7,
  username: "alice",
  display_name: "Alice",
  avatar: "a.png",
  bio: "hi",
  role: "user",
  created_at: "2026-01-01",
};

describe("formatUser", () => {
  it("maps the public user shape", () => {
    expect(formatUser(baseUserRow)).toEqual({
      id: "7",
      username: "alice",
      displayName: "Alice",
      avatar: "a.png",
      bio: "hi",
      role: "user",
      createdAt: "2026-01-01",
    });
  });

  it("omits empty optional fields", () => {
    const out = formatUser({ ...baseUserRow, avatar: null, bio: "" });
    expect(out.avatar).toBeUndefined();
    expect(out.bio).toBeUndefined();
  });

  it("falls back to user_id (session join shape)", () => {
    const { id, ...rest } = baseUserRow;
    expect(formatUser({ ...rest, user_id: 7 }).id).toBe("7");
  });

  it("excludes email unless requested", () => {
    expect(formatUser({ ...baseUserRow, email: "a@b.com" }).email).toBeUndefined();
    expect(formatUser({ ...baseUserRow, email: "a@b.com" }, { includeEmail: true }).email).toBe("a@b.com");
  });
});

describe("formatUserProfile", () => {
  it("adds profile fields to the base shape", () => {
    const out = formatUserProfile({ ...baseUserRow, header: "h.png", location: "NYC", website: "x.com" });
    expect(out.header).toBe("h.png");
    expect(out.location).toBe("NYC");
    expect(out.website).toBe("x.com");
    expect(out.username).toBe("alice");
  });
});

describe("formatAdminUser", () => {
  it("adds disabledAt (null when active)", () => {
    expect(formatAdminUser(baseUserRow).disabledAt).toBeNull();
    expect(formatAdminUser({ ...baseUserRow, disabled_at: "2026-02-02" }).disabledAt).toBe("2026-02-02");
  });
});

describe("formatComment", () => {
  it("maps the comment shape", () => {
    const out = formatComment({
      id: 5,
      post_id: 12,
      user_id: 7,
      username: "alice",
      display_name: "Alice",
      avatar: "a.png",
      role: "user",
      content: "nice",
      created_at: "2026-01-03",
    });
    expect(out).toEqual({
      id: "5",
      postId: "12",
      userId: "7",
      username: "alice",
      displayName: "Alice",
      avatar: "a.png",
      role: "user",
      content: "nice",
      createdAt: "2026-01-03",
    });
  });

  it("omits empty avatar/role", () => {
    const out = formatComment({
      id: 5, post_id: 12, user_id: 7, username: "a", display_name: "A",
      avatar: null, role: null, content: "x", created_at: "t",
    });
    expect(out.avatar).toBeUndefined();
    expect(out.role).toBeUndefined();
  });
});

describe("formatPoll", () => {
  it("returns null for no poll", () => {
    expect(formatPoll(null)).toBeNull();
  });

  it("maps poll options and user vote", () => {
    const poll = {
      id: 3,
      question: "Q?",
      totalVotes: 5,
      options: [{ id: 9, option_text: "A", vote_count: 2, sort_order: 0 }],
    };
    const out = formatPoll(poll, 9);
    expect(out).toEqual({
      id: "3",
      question: "Q?",
      userVote: "9",
      totalVotes: 5,
      options: [{ id: "9", optionText: "A", voteCount: 2, sortOrder: 0 }],
    });
  });
});

describe("formatPost", () => {
  const postRow = {
    id: 12,
    user_id: 7,
    content: "hello",
    media: [{ url: "m.png" }],
    created_at: "2026-01-02",
    reactions: { like: 1 },
    comments: 2,
    username: "alice",
    display_name: "Alice",
    avatar: "a.png",
    role: "user",
  };

  it("maps the post shape with author", () => {
    const out = formatPost(postRow, { userReaction: "like" });
    expect(out.id).toBe("12");
    expect(out.userId).toBe("7");
    expect(out.userReaction).toBe("like");
    expect(out.poll).toBeNull();
    expect(out.author).toEqual({
      username: "alice",
      displayName: "Alice",
      avatar: "a.png",
      role: "user",
    });
  });

  it("omits circleIds unless provided", () => {
    expect("circleIds" in formatPost(postRow)).toBe(false);
    expect(formatPost(postRow, { circleIds: ["1", "2"] }).circleIds).toEqual(["1", "2"]);
  });

  it("defaults media and reactions to empty", () => {
    const out = formatPost({ ...postRow, media: undefined, reactions: undefined });
    expect(out.media).toEqual([]);
    expect(out.reactions).toEqual({});
  });
});
