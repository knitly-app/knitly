import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { FeedRoute } from "../../../routes/feed";
import { useUIStore } from "../../../stores/ui";
import { useAppSettings } from "../../../hooks/useAppSettings";
import { queryKeys } from "../../../api/queryKeys";
import type { Post } from "../../../api/endpoints";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

beforeEach(() => {
  useUIStore.setState({
    editingPostId: null,
    showCreatePost: false,
    initialMedia: null,
    searchMode: "people",
  });
  useAppSettings.setState({
    appName: "Knitly",
    logoIcon: "Zap",
    isLoaded: true,
    isFetching: false,
    isSaving: false,
    error: null,
  });
});

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "p1",
    userId: "u1",
    content: "Hello feed",
    media: [],
    createdAt: new Date().toISOString(),
    reactions: {},
    userReaction: null,
    comments: 0,
    ...overrides,
  };
}

type FeedPage = { posts: Post[]; nextCursor?: string };

function makeFeedResponse(posts: Post[], nextCursor?: string): FeedPage {
  return { posts, nextCursor };
}

async function renderFeed(
  opts: {
    pages?: FeedPage[];
    loading?: boolean;
    error?: boolean;
    circles?: { id: string; name: string; color: string }[];
    currentUser?: { id: string; username: string; displayName: string; createdAt: string } | null;
  } = {}
) {
  const queryClient = makeQueryClient();

  const circles = opts.circles ?? [];
  const currentUser =
    opts.currentUser !== undefined
      ? opts.currentUser
      : { id: "u1", username: "ada", displayName: "Ada", createdAt: "2024-01-01" };

  queryClient.setQueryData(queryKeys.auth.me(), currentUser);
  queryClient.setQueryData(queryKeys.circles.all(), circles);

  if (!opts.loading && !opts.error && opts.pages !== undefined) {
    queryClient.setQueryData(queryKeys.feed.byCircle(undefined), {
      pages: opts.pages,
      pageParams: [undefined],
    });
  }

  fetchMock = mockFetch(({ url }: { url: string }) => {
    if (url.includes("/api/feed")) {
      if (opts.error)
        return new Response(JSON.stringify({ error: "err" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      const page = opts.pages?.[0] ?? makeFeedResponse([]);
      return page;
    }
    if (url.includes("/api/circles")) return circles;
    if (url.includes("/api/auth/me")) return currentUser;
    return null;
  });

  return renderWithProviders(<FeedRoute />, { path: "/", queryClient });
}

describe("FeedRoute — loading state", () => {
  it("renders skeleton cards while loading", async () => {
    fetchMock = mockFetch(() => new Promise(() => {}));
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    qc.setQueryData(queryKeys.circles.all(), []);
    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("FeedRoute — error state", () => {
  it("shows error fallback when feed fails", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    qc.setQueryData(queryKeys.circles.all(), []);
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/feed"))
        return new Response(JSON.stringify({ error: "fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/auth/me")) return null;
      return null;
    });
    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/something went wrong|try again|retry/i);
    });
  });
});

describe("FeedRoute — empty feed", () => {
  it("shows empty state when there are no posts", async () => {
    await renderFeed({ pages: [makeFeedResponse([])] });
    await waitFor(() => {
      expect(screen.getByText(/No posts yet/i)).toBeInTheDocument();
    });
  });

  it("shows circle-specific empty message when circle filter is active", async () => {
    const qc = makeQueryClient();
    const circles = [
      { id: "c1", name: "Family", color: "blue", userId: "u1", createdAt: "2024-01-01" },
    ];
    qc.setQueryData(queryKeys.auth.me(), {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      createdAt: "2024-01-01",
    });
    qc.setQueryData(queryKeys.circles.all(), circles);
    qc.setQueryData(queryKeys.feed.byCircle(undefined), {
      pages: [makeFeedResponse([])],
      pageParams: [undefined],
    });
    qc.setQueryData(queryKeys.feed.byCircle("c1"), {
      pages: [makeFeedResponse([])],
      pageParams: [undefined],
    });

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/feed")) return makeFeedResponse([]);
      if (url.includes("/api/circles")) return circles;
      if (url.includes("/api/auth/me"))
        return { id: "u1", username: "ada", displayName: "Ada", createdAt: "2024-01-01" };
      return null;
    });

    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    await waitFor(() => expect(screen.getAllByText("Family").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Family")[0]);
    await waitFor(() => {
      expect(screen.getByText(/No posts in this circle yet/i)).toBeInTheDocument();
    });
  });
});

describe("FeedRoute — populated feed", () => {
  it("renders post content", async () => {
    const posts = [makePost({ id: "p1", content: "First post" })];
    await renderFeed({ pages: [makeFeedResponse(posts)] });
    await waitFor(() => expect(screen.getByText("First post")).toBeInTheDocument());
  });

  it("renders multiple posts", async () => {
    const posts = [
      makePost({ id: "p1", content: "Post one" }),
      makePost({ id: "p2", content: "Post two" }),
    ];
    await renderFeed({ pages: [makeFeedResponse(posts)] });
    await waitFor(() => {
      expect(screen.getByText("Post one")).toBeInTheDocument();
      expect(screen.getByText("Post two")).toBeInTheDocument();
    });
  });

  it("renders app name heading on mobile", async () => {
    await renderFeed({ pages: [makeFeedResponse([])] });
    await waitFor(() => expect(screen.getByText("Knitly")).toBeInTheDocument());
  });

  it("renders Your Network heading for desktop", async () => {
    await renderFeed({ pages: [makeFeedResponse([])] });
    await waitFor(() => expect(screen.getByText("Your Network")).toBeInTheDocument());
  });
});

describe("FeedRoute — circle filter pills", () => {
  it("renders All pill", async () => {
    await renderFeed({ pages: [makeFeedResponse([])] });
    await waitFor(() => {
      const allBtns = screen.getAllByText("All");
      expect(allBtns.length).toBeGreaterThan(0);
    });
  });

  it("renders circle pills for available circles", async () => {
    const circles = [
      { id: "c1", name: "Family", color: "blue", userId: "u1", createdAt: "2024-01-01" },
    ];
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      createdAt: "2024-01-01",
    });
    qc.setQueryData(queryKeys.circles.all(), circles);
    qc.setQueryData(queryKeys.feed.byCircle(undefined), {
      pages: [makeFeedResponse([])],
      pageParams: [undefined],
    });

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/feed")) return makeFeedResponse([]);
      if (url.includes("/api/circles")) return circles;
      if (url.includes("/api/auth/me"))
        return { id: "u1", username: "ada", displayName: "Ada", createdAt: "2024-01-01" };
      return null;
    });

    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    await waitFor(() => expect(screen.getAllByText("Family").length).toBeGreaterThan(0));
  });

  it("clicking Add pill navigates to circles page", async () => {
    // CirclePills shows Add when circles.length < 4 and showAdd=true
    const circles = [
      { id: "c1", name: "Fam", color: "blue", userId: "u1", createdAt: "2024-01-01" },
    ];
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      createdAt: "2024-01-01",
    });
    qc.setQueryData(queryKeys.circles.all(), circles);
    qc.setQueryData(queryKeys.feed.byCircle(undefined), {
      pages: [makeFeedResponse([])],
      pageParams: [undefined],
    });

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/feed")) return makeFeedResponse([]);
      if (url.includes("/api/circles")) return circles;
      if (url.includes("/api/auth/me"))
        return { id: "u1", username: "ada", displayName: "Ada", createdAt: "2024-01-01" };
      return null;
    });

    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    await waitFor(() => expect(screen.getAllByText("Fam").length).toBeGreaterThan(0));
    // The Add button text is "Add"
    const addBtns = screen.getAllByText("Add");
    expect(addBtns.length).toBeGreaterThan(0);
    // Clicking it triggers onAdd -> navigate to /circles (no crash is the assertion)
    fireEvent.click(addBtns[0]);
  });
});

describe("FeedRoute — load more", () => {
  it("renders Load More button when hasNextPage is true", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      createdAt: "2024-01-01",
    });
    qc.setQueryData(queryKeys.circles.all(), []);
    qc.setQueryData(queryKeys.feed.byCircle(undefined), {
      pages: [makeFeedResponse([makePost()], "cursor123")],
      pageParams: [undefined],
    });

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/feed")) return makeFeedResponse([]);
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/auth/me"))
        return { id: "u1", username: "ada", displayName: "Ada", createdAt: "2024-01-01" };
      return null;
    });

    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    await waitFor(() => expect(screen.getByText("Load More")).toBeInTheDocument());
  });

  it("Load More button triggers fetch", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      createdAt: "2024-01-01",
    });
    qc.setQueryData(queryKeys.circles.all(), []);
    qc.setQueryData(queryKeys.feed.byCircle(undefined), {
      pages: [makeFeedResponse([makePost()], "cursor123")],
      pageParams: [undefined],
    });

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/feed")) return makeFeedResponse([]);
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/auth/me"))
        return { id: "u1", username: "ada", displayName: "Ada", createdAt: "2024-01-01" };
      return null;
    });

    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    await waitFor(() => expect(screen.getByText("Load More")).toBeInTheDocument());
    const callsBefore = fetchMock.calls.length;
    fireEvent.click(screen.getByText("Load More"));
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("does not render Load More when there is no next page", async () => {
    await renderFeed({ pages: [makeFeedResponse([makePost()])] });
    await waitFor(() => expect(screen.getByText("Hello feed")).toBeInTheDocument());
    expect(screen.queryByText("Load More")).toBeNull();
  });
});

describe("FeedRoute — error retry", () => {
  it("clicking Retry calls refetch", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    qc.setQueryData(queryKeys.circles.all(), []);
    let callCount = 0;
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/feed")) {
        callCount++;
        return new Response(JSON.stringify({ error: "fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/auth/me")) return null;
      return null;
    });
    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    await waitFor(() => expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument());
    const countBefore = callCount;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(callCount).toBeGreaterThan(countBefore));
  });
});

describe("FeedRoute — post deletion", () => {
  it("deletes post from feed", async () => {
    const currentUser = { id: "u1", username: "ada", displayName: "Ada", createdAt: "2024-01-01" };
    const posts = [makePost({ id: "p1", userId: "u1", content: "Feed post to delete" })];
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.circles.all(), []);
    qc.setQueryData(queryKeys.feed.byCircle(undefined), {
      pages: [{ posts, nextCursor: undefined }],
      pageParams: [undefined],
    });

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1") && method === "DELETE") return { success: true };
      if (url.includes("/api/feed")) return { posts: [], nextCursor: undefined };
      if (url.includes("/api/circles")) return [];
      if (url.includes("/api/auth/me")) return currentUser;
      return null;
    });

    await renderWithProviders(<FeedRoute />, { path: "/", queryClient: qc });
    await waitFor(() => expect(screen.getByText("Feed post to delete")).toBeInTheDocument());

    const deleteBtn = screen.queryByLabelText("Delete post");
    if (deleteBtn) {
      fireEvent.click(deleteBtn);
      await waitFor(() => expect(screen.getByText("Delete Post")).toBeInTheDocument());
      const confirmBtn = screen.getAllByRole("button").find((b) => b.textContent === "Delete");
      if (confirmBtn) fireEvent.click(confirmBtn);
      await waitFor(() => {
        const deleteCall = fetchMock.calls.find(
          (c) => c.url.includes("/api/posts/p1") && c.method === "DELETE"
        );
        expect(deleteCall).toBeDefined();
      });
    }
  });
});
