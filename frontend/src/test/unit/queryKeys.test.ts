import { describe, it, expect } from "bun:test";
import { queryKeys } from "../../api/queryKeys";

describe("queryKeys", () => {
  describe("auth", () => {
    it("me returns stable key", () => {
      expect(queryKeys.auth.me()).toEqual(["auth", "me"]);
    });

    it("resetToken includes the token", () => {
      expect(queryKeys.auth.resetToken("abc")).toEqual(["auth", "reset-token", "abc"]);
    });

    it("confirmEmail includes the token", () => {
      expect(queryKeys.auth.confirmEmail("tok")).toEqual(["confirm-email", "tok"]);
    });
  });

  describe("feed", () => {
    it("all returns base feed key", () => {
      expect(queryKeys.feed.all()).toEqual(["feed"]);
    });

    it("byCircle with a circleId returns scoped key", () => {
      expect(queryKeys.feed.byCircle("c1")).toEqual(["feed", "c1"]);
    });

    it("byCircle without argument returns base feed key", () => {
      expect(queryKeys.feed.byCircle()).toEqual(["feed"]);
    });

    it("byCircle with undefined returns base feed key", () => {
      expect(queryKeys.feed.byCircle(undefined)).toEqual(["feed"]);
    });

    it("scoped key is prefixed by all() (invalidation contract)", () => {
      const scoped = queryKeys.feed.byCircle("c1");
      const prefix = queryKeys.feed.all();
      expect(scoped.slice(0, prefix.length)).toEqual([...prefix]);
    });
  });

  describe("posts", () => {
    it("all returns base posts key", () => {
      expect(queryKeys.posts.all()).toEqual(["posts"]);
    });

    it("detail includes post id", () => {
      expect(queryKeys.posts.detail("p1")).toEqual(["posts", "p1"]);
    });

    it("comments includes post id and 'comments'", () => {
      expect(queryKeys.posts.comments("p1")).toEqual(["posts", "p1", "comments"]);
    });
  });

  describe("users", () => {
    it("all returns base users key", () => {
      expect(queryKeys.users.all()).toEqual(["users"]);
    });

    it("detail includes user id", () => {
      expect(queryKeys.users.detail("u1")).toEqual(["users", "u1"]);
    });

    it("posts includes user id and 'posts'", () => {
      expect(queryKeys.users.posts("u1")).toEqual(["users", "u1", "posts"]);
    });

    it("media includes user id and 'media'", () => {
      expect(queryKeys.users.media("u1")).toEqual(["users", "u1", "media"]);
    });
  });

  describe("circles", () => {
    it("all returns base circles key", () => {
      expect(queryKeys.circles.all()).toEqual(["circles"]);
    });

    it("detail includes circle id", () => {
      expect(queryKeys.circles.detail("c1")).toEqual(["circles", "c1"]);
    });
  });

  describe("top-level keys", () => {
    it("members returns stable key", () => {
      expect(queryKeys.members()).toEqual(["members"]);
    });

    it("notifications returns stable key", () => {
      expect(queryKeys.notifications()).toEqual(["notifications"]);
    });

    it("invite includes the token", () => {
      expect(queryKeys.invite("inv1")).toEqual(["invite", "inv1"]);
    });
  });

  describe("chat", () => {
    it("messages returns stable key", () => {
      expect(queryKeys.chat.messages()).toEqual(["chat", "messages"]);
    });

    it("messagesAccumulated returns stable key", () => {
      expect(queryKeys.chat.messagesAccumulated()).toEqual(["chat", "messages", "accumulated"]);
    });

    it("presence returns stable key", () => {
      expect(queryKeys.chat.presence()).toEqual(["chat", "presence"]);
    });

    it("status returns stable key", () => {
      expect(queryKeys.chat.status()).toEqual(["chat", "status"]);
    });
  });

  describe("search", () => {
    it("users includes the query", () => {
      expect(queryKeys.search.users("alice")).toEqual(["search", "users", "alice"]);
    });

    it("posts includes the query", () => {
      expect(queryKeys.search.posts("yarn")).toEqual(["search", "posts", "yarn"]);
    });

    it("mentions includes the query", () => {
      expect(queryKeys.search.mentions("bob")).toEqual(["mention-search", "bob"]);
    });
  });

  describe("admin", () => {
    it("stats returns stable key", () => {
      expect(queryKeys.admin.stats()).toEqual(["admin", "stats"]);
    });

    it("users returns stable key", () => {
      expect(queryKeys.admin.users()).toEqual(["admin", "users"]);
    });

    it("bots returns stable key", () => {
      expect(queryKeys.admin.bots()).toEqual(["admin", "bots"]);
    });

    it("invites returns stable key", () => {
      expect(queryKeys.admin.invites()).toEqual(["admin", "invites"]);
    });

    it("audit returns stable key", () => {
      expect(queryKeys.admin.audit()).toEqual(["admin", "audit"]);
    });

    it("content with query returns scoped key", () => {
      expect(queryKeys.admin.content("foo")).toEqual(["admin", "content", "foo"]);
    });

    it("content without argument returns base key", () => {
      expect(queryKeys.admin.content()).toEqual(["admin", "content"]);
    });

    it("content with undefined returns base key", () => {
      expect(queryKeys.admin.content(undefined)).toEqual(["admin", "content"]);
    });
  });
});
