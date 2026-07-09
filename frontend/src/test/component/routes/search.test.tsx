import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { SearchRoute } from "../../../routes/search";
import { useUIStore } from "../../../stores/ui";
import { queryKeys } from "../../../api/queryKeys";
import type { User, Post } from "../../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

beforeEach(() => {
  useUIStore.setState({
    editingPostId: null,
    showCreatePost: false,
    initialMedia: null,
    searchMode: "people",
  });
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    username: "ada",
    displayName: "Ada Lovelace",
    createdAt: "2024-01-01",
    ...overrides,
  };
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "p1",
    userId: "u1",
    content: "Search result post",
    media: [],
    createdAt: new Date().toISOString(),
    reactions: {},
    userReaction: null,
    comments: 0,
    ...overrides,
  };
}

async function renderSearch() {
  const qc = makeQueryClient();
  fetchMock = mockFetch(({ url }: { url: string }) => {
    if (url.includes("/api/search/users")) {
      const urlObj = new URL(url, "http://localhost");
      const q = urlObj.searchParams.get("q") ?? "";
      if (q.length < 2) return [];
      return [makeUser({ displayName: "Ada Lovelace" })];
    }
    if (url.includes("/api/search/posts")) {
      const urlObj = new URL(url, "http://localhost");
      const q = urlObj.searchParams.get("q") ?? "";
      if (q.length < 2) return [];
      return [makePost({ content: "Found post" })];
    }
    if (url.includes("/api/auth/me")) return null;
    return null;
  });
  return renderWithProviders(<SearchRoute />, { path: "/search", queryClient: qc });
}

describe("SearchRoute — initial state", () => {
  it("renders the search input", async () => {
    await renderSearch();
    expect(screen.getByPlaceholderText("Search friends & family...")).toBeInTheDocument();
  });

  it("renders People and Posts mode buttons", async () => {
    await renderSearch();
    expect(screen.getByRole("button", { name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Posts" })).toBeInTheDocument();
  });

  it("shows the initial empty hint when query is too short", async () => {
    await renderSearch();
    expect(screen.getByText(/Search for people or moments/i)).toBeInTheDocument();
  });
});

describe("SearchRoute — mode switching", () => {
  it("switches to posts mode when Posts button is clicked", async () => {
    await renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Posts" }));
    expect(useUIStore.getState().searchMode).toBe("posts");
  });

  it("switches back to people mode when People button is clicked after switching", async () => {
    await renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Posts" }));
    fireEvent.click(screen.getByRole("button", { name: "People" }));
    expect(useUIStore.getState().searchMode).toBe("people");
  });
});

describe("SearchRoute — query less than 2 chars", () => {
  it("shows hint when only one character is typed", async () => {
    await renderSearch();
    const input = screen.getByPlaceholderText("Search friends & family...");
    fireEvent.input(input, { target: { value: "a" } });
    await waitFor(() => {
      expect(screen.getByText(/Search for people or moments/i)).toBeInTheDocument();
    });
  });
});

describe("SearchRoute — people search", () => {
  it("shows skeleton while loading people", async () => {
    let resolve: ((v: unknown) => void) | null = null;
    const qc = makeQueryClient();
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/search/users"))
        return new Promise((r) => {
          resolve = r;
        });
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<SearchRoute />, { path: "/search", queryClient: qc });
    const input = screen.getByPlaceholderText("Search friends & family...");
    fireEvent.input(input, { target: { value: "ada" } });

    await waitFor(() => {
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
    resolve?.(null);
  });

  it("renders user results after typing 2+ chars in people mode", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.users("ad"), [makeUser({ displayName: "Ada Lovelace" })]);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/search/users")) return [makeUser({ displayName: "Ada Lovelace" })];
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<SearchRoute />, { path: "/search", queryClient: qc });
    const input = screen.getByPlaceholderText("Search friends & family...");
    fireEvent.input(input, { target: { value: "ad" } });

    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
  });

  it("shows empty state when no users found", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.users("xyz"), []);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/search/users")) return [];
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<SearchRoute />, { path: "/search", queryClient: qc });
    const input = screen.getByPlaceholderText("Search friends & family...");
    fireEvent.input(input, { target: { value: "xyz" } });

    await waitFor(() => {
      expect(screen.getByText(/No users found/i)).toBeInTheDocument();
    });
  });
});

describe("SearchRoute — posts search", () => {
  it("shows skeleton while loading posts", async () => {
    let resolve: ((v: unknown) => void) | null = null;
    const qc = makeQueryClient();
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/search/posts"))
        return new Promise((r) => {
          resolve = r;
        });
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    useUIStore.setState({ searchMode: "posts" } as Parameters<typeof useUIStore.setState>[0]);
    await renderWithProviders(<SearchRoute />, { path: "/search", queryClient: qc });
    const input = screen.getByPlaceholderText("Search friends & family...");
    fireEvent.input(input, { target: { value: "hello" } });

    await waitFor(() => {
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
    resolve?.(null);
  });

  it("renders post results in posts mode", async () => {
    useUIStore.setState({ searchMode: "posts" } as Parameters<typeof useUIStore.setState>[0]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.posts("he"), [makePost({ content: "Found post content" })]);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/search/posts")) return [makePost({ content: "Found post content" })];
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<SearchRoute />, { path: "/search", queryClient: qc });
    const input = screen.getByPlaceholderText("Search friends & family...");
    fireEvent.input(input, { target: { value: "he" } });

    await waitFor(() => {
      expect(screen.getByText("Found post content")).toBeInTheDocument();
    });
  });

  it("shows empty state when no posts found", async () => {
    useUIStore.setState({ searchMode: "posts" } as Parameters<typeof useUIStore.setState>[0]);
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.search.posts("xyz"), []);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/search/posts")) return [];
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<SearchRoute />, { path: "/search", queryClient: qc });
    const input = screen.getByPlaceholderText("Search friends & family...");
    fireEvent.input(input, { target: { value: "xyz" } });

    await waitFor(() => {
      expect(screen.getByText(/No posts found/i)).toBeInTheDocument();
    });
  });

  it("clicking a reaction emoji on a search post result calls the reaction mutation", async () => {
    useUIStore.setState({ searchMode: "posts" } as Parameters<typeof useUIStore.setState>[0]);
    const qc = makeQueryClient();
    const post = makePost({ id: "p1", content: "Reactive post" });
    qc.setQueryData(queryKeys.search.posts("re"), [post]);

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1/react") && method === "POST") return { success: true };
      if (url.includes("/api/search/posts")) return [post];
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<SearchRoute />, { path: "/search", queryClient: qc });
    const input = screen.getByPlaceholderText("Search friends & family...");
    fireEvent.input(input, { target: { value: "re" } });

    await waitFor(() => expect(screen.getByText("Reactive post")).toBeInTheDocument());

    // Open the reaction picker
    const reactBtn = screen.getByLabelText("React to post");
    fireEvent.click(reactBtn);

    await waitFor(() => expect(screen.getByTitle("Love")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Love"));

    await waitFor(() => {
      const reactCall = fetchMock.calls.find(
        (c) => c.url.includes("/api/posts/p1/react") && c.method === "POST"
      );
      expect(reactCall).toBeDefined();
    });
  });
});
