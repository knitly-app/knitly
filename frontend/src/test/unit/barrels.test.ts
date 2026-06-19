import { describe, it, expect } from "bun:test";
import * as hooks from "../../hooks";
import * as components from "../../components";
import * as routes from "../../routes";

describe("barrel exports", () => {
  it("hooks/index re-exports every hook", () => {
    for (const name of [
      "useAuth",
      "useFeed",
      "usePost",
      "useUserPosts",
      "useCreatePost",
      "useReaction",
      "usePostComments",
      "useAddComment",
      "useEditPost",
      "useNotifications",
      "useMarkNotificationRead",
      "useMarkAllNotificationsRead",
      "useUnreadCount",
    ]) {
      expect(typeof (hooks as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("components/index re-exports its components", () => {
    for (const name of [
      "Navigation",
      "PostCard",
      "CreatePostModal",
      "ProfileCard",
      "CircleOnboarding",
    ]) {
      expect(typeof (components as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("routes/index re-exports every route component", () => {
    for (const name of [
      "FeedRoute",
      "LoginRoute",
      "SignupRoute",
      "InviteRoute",
      "ProfileRoute",
      "PostRoute",
      "SearchRoute",
      "NotificationsRoute",
      "SettingsRoute",
      "AdminRoute",
      "MembersRoute",
      "CirclesRoute",
    ]) {
      expect(typeof (routes as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
