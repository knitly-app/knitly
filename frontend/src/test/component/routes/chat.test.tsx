import { describe, it, expect, afterEach } from "bun:test";
import { screen, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { ChatRoute } from "../../../routes/chat";
import { queryKeys } from "../../../api/queryKeys";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

const baseUser = {
  id: "u1",
  username: "ada",
  displayName: "Ada Lovelace",
  createdAt: "2024-01-01",
};

function makeChatFetch(messages: unknown[] = []) {
  return mockFetch(({ url, method }: { url: string; method: string }) => {
    if (url.includes("/api/auth/me")) return baseUser;
    if (url.includes("/api/chat/messages") && method === "GET") return { messages };
    if (url.includes("/api/chat/presence") && method === "POST") {
      return { online: 1, users: ["ada"], joins: [], leaves: [] };
    }
    if (url.includes("/api/chat/status")) return { online: 1 };
    if (url.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
    return null;
  });
}

async function renderChat(messages: unknown[] = []) {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.auth.me(), baseUser);
  qc.setQueryData(queryKeys.chat.messagesAccumulated(), messages);
  qc.setQueryData(queryKeys.chat.status(), { online: 1 });
  fetchMock = makeChatFetch(messages);
  return renderWithProviders(<ChatRoute />, {
    path: "/chat",
    initialEntries: ["/chat"],
    queryClient: qc,
  });
}

describe("ChatRoute — render", () => {
  it("renders the route wrapper", async () => {
    await renderChat();
    // ChatRoom renders "The Lobby" heading after loading
    await waitFor(() => {
      expect(screen.getByText("The Lobby")).toBeInTheDocument();
    });
  });

  it("renders 'Chat with your people' subtitle", async () => {
    await renderChat();
    await waitFor(() => {
      expect(screen.getByText("Chat with your people")).toBeInTheDocument();
    });
  });

  it("shows empty message state with no messages", async () => {
    await renderChat([]);
    await waitFor(() => {
      expect(screen.getByText("No messages yet. Say hello!")).toBeInTheDocument();
    });
  });

  it("renders a chat message when present", async () => {
    const msg = {
      id: "m1",
      userId: "u1",
      username: "ada",
      displayName: "Ada Lovelace",
      content: "Hello everyone!",
      createdAt: new Date().toISOString(),
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), baseUser);
    qc.setQueryData(queryKeys.chat.messagesAccumulated(), [msg]);
    qc.setQueryData(queryKeys.chat.status(), { online: 1 });
    fetchMock = makeChatFetch([msg]);
    await renderWithProviders(<ChatRoute />, {
      path: "/chat",
      initialEntries: ["/chat"],
      queryClient: qc,
    });
    await waitFor(() => {
      expect(screen.getByText("Hello everyone!")).toBeInTheDocument();
    });
  });

  it("renders the chat input area", async () => {
    await renderChat();
    await waitFor(() => {
      const input = document.querySelector("textarea, input[placeholder]");
      expect(input).toBeInTheDocument();
    });
  });

  it("renders presence badge", async () => {
    await renderChat();
    await waitFor(() => {
      // ChatPresenceBadge with online count 1
      expect(screen.getByText(/1/)).toBeInTheDocument();
    });
  });
});
