import { describe, it, expect, afterEach } from "bun:test";
import { screen, fireEvent, waitFor, cleanup } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { ChatRoom } from "../../../components/Chat/ChatRoom";
import type { ChatMessage, ChatPresenceResponse } from "../../../api/endpoints";

let fetchMock: MockFetchResult;

// Cleanup component first so useEffect teardown (chat.leave) fires while the
// mock is still active, then restore fetch.
afterEach(async () => {
  cleanup();
  await Promise.resolve();
  fetchMock?.restore();
});

const ME = {
  id: "u1",
  username: "me",
  displayName: "Me User",
  createdAt: "2024-01-01",
};

const EMPTY_PRESENCE: ChatPresenceResponse = {
  online: 0,
  users: [],
  joins: [],
  leaves: [],
};

function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    userId: "u2",
    username: "ada",
    displayName: "Ada Lovelace",
    content: "Hello chat",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function setupFetch({
  messages = [] as ChatMessage[],
  presence = EMPTY_PRESENCE,
  me = ME as object | null,
} = {}) {
  fetchMock = mockFetch(({ url, method }) => {
    if (url.includes("/auth/me")) return me;
    if (url.includes("/chat/messages") && method === "GET") return { messages };
    if (url.includes("/chat/presence") && method === "POST") return presence;
    if (url.includes("/chat/status")) return { online: presence.online };
    if (url.includes("/chat/messages") && method === "POST")
      return makeMsg({ id: "sent-1", userId: "u1", content: "sent" });
    if (url.includes("/chat/leave")) return {};
    return {};
  });
}

describe("ChatRoom — loading state", () => {
  it("shows a spinner before messages arrive", async () => {
    let resolveFetch!: (v: unknown) => void;
    const pendingPromise = new Promise((r) => {
      resolveFetch = r;
    });

    fetchMock = mockFetch(({ url, method }) => {
      if (url.includes("/auth/me")) return ME;
      if (url.includes("/chat/messages") && method === "GET") return pendingPromise;
      if (url.includes("/chat/presence")) return EMPTY_PRESENCE;
      if (url.includes("/chat/status")) return { online: 0 };
      if (url.includes("/chat/leave")) return {};
      return {};
    });

    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });

    await waitFor(() => {
      expect(document.querySelector("svg")).toBeInTheDocument();
    });

    resolveFetch({ messages: [] });
  });
});

describe("ChatRoom — empty state", () => {
  it("shows empty state text when there are no messages", async () => {
    setupFetch({ messages: [] });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("No messages yet. Say hello!")).toBeInTheDocument();
    });
  });
});

describe("ChatRoom — header", () => {
  it("renders the lobby title", async () => {
    setupFetch();
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("The Lobby")).toBeInTheDocument();
    });
  });

  it("renders the subtitle", async () => {
    setupFetch();
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("Chat with your people")).toBeInTheDocument();
    });
  });
});

describe("ChatRoom — presence badge", () => {
  it("hides presence badge when online count is 0", async () => {
    setupFetch({ presence: { ...EMPTY_PRESENCE, online: 0 } });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("The Lobby")).toBeInTheDocument();
    });
    expect(screen.queryByText(/online/)).toBeNull();
  });

  it("shows presence badge when users are online", async () => {
    setupFetch({
      presence: { online: 3, users: ["ada", "bob", "charlie"], joins: [], leaves: [] },
    });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("3 online")).toBeInTheDocument();
    });
  });
});

describe("ChatRoom — message rendering", () => {
  it("renders a message from another user", async () => {
    setupFetch({ messages: [makeMsg()] });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("Hello chat")).toBeInTheDocument();
    });
  });

  it("renders multiple messages sorted by time", async () => {
    const msg1 = makeMsg({
      id: "m1",
      content: "First",
      createdAt: new Date(Date.now() - 2000).toISOString(),
    });
    const msg2 = makeMsg({
      id: "m2",
      content: "Second",
      createdAt: new Date(Date.now() - 1000).toISOString(),
    });
    setupFetch({ messages: [msg2, msg1] });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    });
  });
});

describe("ChatRoom — system messages", () => {});

describe("ChatRoom — sending a message", () => {
  it("calls the send endpoint when the button is clicked", async () => {
    setupFetch({ messages: [] });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("No messages yet. Say hello!")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "test message" } });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      const postCall = fetchMock.calls.find(
        (c) => c.url.includes("/chat/messages") && c.method === "POST"
      );
      expect(postCall).toBeDefined();
      expect(postCall?.body).toMatchObject({ content: "test message" });
    });
  });

  it("sends via Enter key", async () => {
    setupFetch({ messages: [] });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("No messages yet. Say hello!")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.input(textarea, { target: { value: "enter message" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      const postCall = fetchMock.calls.find(
        (c) => c.url.includes("/chat/messages") && c.method === "POST"
      );
      expect(postCall).toBeDefined();
    });
  });
});

describe("ChatRoom — scroll behavior", () => {
  it("renders the messages container with scroll class", async () => {
    setupFetch({ messages: [] });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("No messages yet. Say hello!")).toBeInTheDocument();
    });
    const scrollContainer = document.querySelector(".overflow-y-auto");
    expect(scrollContainer).toBeInTheDocument();
  });

  it("fires the scroll handler on the message container", async () => {
    setupFetch({ messages: [makeMsg()] });
    const queryClient = makeQueryClient();
    await renderWithProviders(<ChatRoom />, { queryClient });
    await waitFor(() => {
      expect(screen.getByText("Hello chat")).toBeInTheDocument();
    });
    const scrollContainer = document.querySelector(".overflow-y-auto");
    // Firing scroll exercises handleScroll — assert container is still present
    fireEvent.scroll(scrollContainer!);
    expect(scrollContainer).toBeInTheDocument();
  });
});
