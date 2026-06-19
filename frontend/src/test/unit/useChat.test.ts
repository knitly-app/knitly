import { describe, it, expect, afterEach } from "bun:test";
import { h } from "preact";
import { renderHook, waitFor, act } from "@testing-library/preact";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChatMessages, useChatStatus, useChatPresenceHeartbeat } from "../../hooks/useChat";
import { makeQueryClient } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

function renderWithClient<T>(cb: () => T, queryClient: QueryClient = makeQueryClient()) {
  return renderHook(cb, {
    wrapper: ({ children }) => h(QueryClientProvider, { client: queryClient }, children),
  });
}

const message = {
  id: "m1",
  userId: "u1",
  username: "ada",
  displayName: "Ada",
  content: "hello",
  createdAt: "2024-01-01",
};

const presenceResponse = {
  online: 2,
  users: ["ada", "bob"],
  joins: [],
  leaves: [],
};

describe("useChatStatus", () => {
  it("fetches chat status and returns online count", async () => {
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/chat/status")) return { online: 5 };
      return presenceResponse;
    });
    const { result } = renderWithClient(() => useChatStatus());
    await waitFor(() => expect(result.current).toBe(5));
    const statusCall = fetchMock.calls.find((c) => c.url.includes("/chat/status"));
    expect(statusCall).toMatchObject({ method: "GET" });
  });

  it("returns 0 when data is not yet loaded", () => {
    fetchMock = mockFetch(() => new Promise(() => {}));
    const { result } = renderWithClient(() => useChatStatus());
    expect(result.current).toBe(0);
  });
});

describe("useChatMessages", () => {
  it("returns initial empty messages before fetch completes", () => {
    fetchMock = mockFetch(() => new Promise(() => {}));
    const { result } = renderWithClient(() => useChatMessages());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("accumulates messages from chat.messages", async () => {
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/chat/messages") && !url.includes("accumulated")) {
        return { messages: [message] };
      }
      if (url.includes("/chat/presence")) return presenceResponse;
      return { messages: [] };
    });

    const { result } = renderWithClient(() => useChatMessages());
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    expect(result.current.messages[0].id).toBe("m1");
  });

  it("deduplicate messages when poll returns same ids", async () => {
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/chat/presence")) return presenceResponse;
      if (url.includes("/chat/messages")) return { messages: [message] };
      return {};
    });

    const { result } = renderWithClient(() => useChatMessages());
    await waitFor(() => expect(result.current.messages.length).toBe(1));
    expect(result.current.messages).toHaveLength(1);
  });

  it("send posts a message and appends it to accumulated messages", async () => {
    fetchMock = mockFetch(({ url, method }) => {
      if (url.includes("/chat/presence")) return presenceResponse;
      if (url.includes("/chat/messages") && method === "POST") return message;
      return { messages: [] };
    });

    const { result } = renderWithClient(() => useChatMessages());
    result.current.send("hello");
    await waitFor(() =>
      expect(
        fetchMock.calls.some((c) => c.method === "POST" && c.url.includes("/chat/messages"))
      ).toBe(true)
    );
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    expect(result.current.messages[0].content).toBe("hello");
  });

  it("send skips duplicate message already in accumulated list", async () => {
    fetchMock = mockFetch(({ url, method }) => {
      if (url.includes("/chat/presence")) return presenceResponse;
      if (url.includes("/chat/messages") && method === "POST") return message;
      return { messages: [message] };
    });

    const { result } = renderWithClient(() => useChatMessages());
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    result.current.send("hello");
    await waitFor(() =>
      expect(
        fetchMock.calls.some((c) => c.method === "POST" && c.url.includes("/chat/messages"))
      ).toBe(true)
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
  });

  it("exposes online count and users from presence", async () => {
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/chat/presence")) {
        return { online: 3, users: ["ada", "bob", "charlie"], joins: [], leaves: [] };
      }
      return { messages: [] };
    });

    const { result } = renderWithClient(() => useChatMessages());
    await waitFor(() => expect(result.current.onlineCount).toBe(3));
    expect(result.current.onlineUsers).toEqual(["ada", "bob", "charlie"]);
  });

  it("adds join system message when a new user appears", async () => {
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/chat/presence")) {
        return { online: 1, users: ["newuser"], joins: ["newuser"], leaves: [] };
      }
      return { messages: [] };
    });

    const { result } = renderWithClient(() => useChatMessages());
    await waitFor(() => expect(result.current.systemMessages.length).toBeGreaterThan(0));
    expect(result.current.systemMessages[0].type).toBe("join");
    expect(result.current.systemMessages[0].username).toBe("newuser");
  });

  it("skips join system message for user already tracked in previousUsersRef", async () => {
    let presenceCallCount = 0;
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/chat/presence")) {
        presenceCallCount++;
        return {
          online: 1,
          users: ["ada"],
          joins: presenceCallCount === 1 ? ["ada"] : ["ada"],
          leaves: [],
        };
      }
      return { messages: [] };
    });

    const { result } = renderWithClient(() => useChatMessages());
    await waitFor(() => expect(result.current.systemMessages.length).toBeGreaterThan(0));
    const joinCount = result.current.systemMessages.filter((m) => m.type === "join").length;
    expect(joinCount).toBe(1);
  });

  it("adds leave system message when a user leaves", async () => {
    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/chat/presence")) {
        return { online: 0, users: [], joins: [], leaves: ["ada"] };
      }
      return { messages: [] };
    });

    const { result } = renderWithClient(() => useChatMessages());
    await waitFor(() => expect(result.current.systemMessages.length).toBeGreaterThan(0));
    expect(result.current.systemMessages[0].type).toBe("leave");
    expect(result.current.systemMessages[0].username).toBe("ada");
  });

  it("executes stale-message pruning callback registered by the cleanup interval", async () => {
    const intercepted: (() => void)[] = [];
    const originalSetInterval = globalThis.setInterval;
    globalThis.setInterval = ((cb: () => void, ms: number) => {
      if (ms === 10000) {
        intercepted.push(cb);
        return 9999 as unknown as ReturnType<typeof setInterval>;
      }
      return originalSetInterval(cb, ms);
    }) as typeof setInterval;

    fetchMock = mockFetch(({ url }) => {
      if (url.includes("/chat/presence")) return presenceResponse;
      return { messages: [] };
    });

    const { unmount } = renderWithClient(() => useChatMessages());
    await waitFor(() => expect(intercepted.length).toBeGreaterThan(0));

    await act(() => {
      for (const cb of intercepted) cb();
    });

    unmount();
    globalThis.setInterval = originalSetInterval;
    expect(intercepted.length).toBeGreaterThan(0);
  });
});

describe("useChatPresenceHeartbeat", () => {
  it("calls /api/chat/presence immediately on mount", async () => {
    fetchMock = mockFetch({});
    const { unmount } = renderWithClient(() => useChatPresenceHeartbeat());
    await waitFor(() =>
      expect(fetchMock.calls.some((c) => c.url.includes("/chat/presence"))).toBe(true)
    );
    unmount();
  });

  it("calls presence again via the interval callback", async () => {
    const intervalCallbacks: (() => void)[] = [];
    const originalSetInterval = globalThis.setInterval;
    globalThis.setInterval = ((cb: () => void, ms: number) => {
      if (ms === 30000) {
        intervalCallbacks.push(cb);
        return 8888 as unknown as ReturnType<typeof setInterval>;
      }
      return originalSetInterval(cb, ms);
    }) as typeof setInterval;

    fetchMock = mockFetch({});
    const { unmount } = renderWithClient(() => useChatPresenceHeartbeat());
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(0));

    const callsBefore = fetchMock.calls.length;
    for (const cb of intervalCallbacks) cb();
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(callsBefore));

    unmount();
    globalThis.setInterval = originalSetInterval;
  });

  it("fires sendBeacon when beforeunload event is dispatched", async () => {
    const beaconUrls: string[] = [];
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string) => {
      beaconUrls.push(url);
      return true;
    };

    fetchMock = mockFetch({});
    const { unmount } = renderWithClient(() => useChatPresenceHeartbeat());
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(0));

    window.dispatchEvent(new Event("beforeunload"));
    expect(beaconUrls).toContain("/api/chat/leave");

    unmount();
    navigator.sendBeacon = originalSendBeacon;
  });

  it("cleans up on unmount without throwing", async () => {
    fetchMock = mockFetch({});
    const { unmount } = renderWithClient(() => useChatPresenceHeartbeat());
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(0));
    expect(() => unmount()).not.toThrow();
  });
});
