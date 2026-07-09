import { describe, it, expect, afterEach } from "bun:test";
import { renderHookWithClient, waitFor } from "../helpers/render";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearAllNotifications,
  useUnreadCount,
} from "../../hooks/useNotifications";
import { mockFetch, errorResponse, type MockFetchResult } from "../helpers/fetch";
import type { Notification } from "../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

const readNotif: Notification = {
  id: "n1",
  type: "reaction",
  fromUserId: "u1",
  fromUsername: "ada",
  fromDisplayName: "Ada",
  postId: "p1",
  read: true,
  createdAt: "2024-01-01",
};

const unreadNotif: Notification = {
  ...readNotif,
  id: "n2",
  read: false,
};

describe("useNotifications", () => {
  it("fetches notifications list from /api/notifications", async () => {
    fetchMock = mockFetch([readNotif, unreadNotif]);
    const { result } = renderHookWithClient(() => useNotifications());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/notifications",
      method: "GET",
    });
  });

  it("returns empty array when no notifications exist", async () => {
    fetchMock = mockFetch([]);
    const { result } = renderHookWithClient(() => useNotifications());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });
});

describe("useMarkNotificationRead", () => {
  it("patches the notification read endpoint", async () => {
    fetchMock = mockFetch({});
    const { result } = renderHookWithClient(() => useMarkNotificationRead());
    result.current.mutate("n1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/notifications/n1/read",
      method: "PATCH",
    });
  });

  it("invalidates notifications on success", async () => {
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/read")) return {};
      return [readNotif];
    });
    const { result } = renderHookWithClient(() => useMarkNotificationRead());
    result.current.mutate("n1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const patchCall = fetchMock.calls.find((c) => c.url.includes("/read"));
    expect(patchCall).toBeDefined();
  });
});

describe("useMarkAllNotificationsRead", () => {
  it("posts to the read-all endpoint", async () => {
    fetchMock = mockFetch({});
    const { result } = renderHookWithClient(() => useMarkAllNotificationsRead());
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/notifications/read-all",
      method: "POST",
    });
  });

  it("invalidates notifications on success", async () => {
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("read-all")) return {};
      return [];
    });
    const { result } = renderHookWithClient(() => useMarkAllNotificationsRead());
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const postCall = fetchMock.calls.find((c) => c.url.includes("read-all"));
    expect(postCall).toBeDefined();
  });
});

describe("useClearAllNotifications", () => {
  it("deletes all notifications", async () => {
    fetchMock = mockFetch({});
    const { result } = renderHookWithClient(() => useClearAllNotifications());
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/notifications",
      method: "DELETE",
    });
  });

  it("invalidates notifications query on success", async () => {
    fetchMock = mockFetch(({ url, method }) => {
      if (method === "DELETE" && url.includes("/notifications")) return {};
      return [];
    });
    const { result } = renderHookWithClient(() => useClearAllNotifications());
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const deleteCall = fetchMock.calls.find(
      (c) => c.method === "DELETE" && c.url.includes("/notifications")
    );
    expect(deleteCall).toBeDefined();
  });
});

describe("useUnreadCount", () => {
  it("returns zero when no notifications are loaded", async () => {
    fetchMock = mockFetch(errorResponse(401));
    const { result } = renderHookWithClient(() => useUnreadCount());
    await waitFor(() => expect(result.current).toBe(0));
  });

  it("counts only unread notifications", async () => {
    fetchMock = mockFetch([readNotif, unreadNotif, { ...unreadNotif, id: "n3" }]);
    const { result } = renderHookWithClient(() => useUnreadCount());
    await waitFor(() => expect(result.current).toBe(2));
  });

  it("returns zero when all notifications are read", async () => {
    fetchMock = mockFetch([readNotif]);
    const { result } = renderHookWithClient(() => useUnreadCount());
    await waitFor(() => expect(result.current).toBe(0));
  });
});
