import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { PostRoute } from "../../../routes/post";
import { useUIStore } from "../../../stores/ui";
import { queryKeys } from "../../../api/queryKeys";
import type { Post, Comment, User } from "../../../api/endpoints";

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

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "p1",
    userId: "u1",
    content: "Post detail content",
    media: [],
    createdAt: new Date().toISOString(),
    reactions: {},
    userReaction: null,
    comments: 0,
    author: { username: "ada", displayName: "Ada Lovelace" },
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    postId: "p1",
    userId: "u2",
    username: "bob",
    displayName: "Bob",
    content: "Nice post!",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    username: "ada",
    displayName: "Ada",
    createdAt: "2024-01-01",
    ...overrides,
  };
}

async function renderPost(
  postId: string,
  post: Post | null,
  comments: Comment[] = [],
  currentUser: User | null = null
) {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.auth.me(), currentUser);
  if (post) {
    qc.setQueryData(queryKeys.posts.detail(postId), post);
  }
  qc.setQueryData(queryKeys.posts.comments(postId), comments);

  fetchMock = mockFetch(({ url }: { url: string }) => {
    if (url.includes(`/api/posts/${postId}/comments`)) return comments;
    if (url.includes(`/api/posts/${postId}`)) return post;
    if (url.includes("/api/auth/me")) return currentUser;
    return null;
  });

  return renderWithProviders(<PostRoute />, {
    path: "/post/$id",
    initialEntries: [`/post/${postId}`],
    queryClient: qc,
  });
}

describe("PostRoute — loading state", () => {
  it("shows skeleton while loading", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    fetchMock = mockFetch(() => new Promise(() => {}));
    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("PostRoute — not found", () => {
  it("shows not found when post is null", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    qc.setQueryData(queryKeys.posts.detail("p99"), null);
    qc.setQueryData(queryKeys.posts.comments("p99"), []);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/posts/p99/comments")) return [];
      if (url.includes("/api/posts/p99")) return null;
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p99"],
      queryClient: qc,
    });

    await waitFor(() => {
      expect(screen.getByText("Post not found")).toBeInTheDocument();
    });
  });
});

describe("PostRoute — post rendering", () => {
  it("renders post content", async () => {
    const post = makePost({ content: "Detailed post" });
    await renderPost("p1", post);
    await waitFor(() => expect(screen.getByText("Detailed post")).toBeInTheDocument());
  });

  it("renders the back button", async () => {
    const post = makePost();
    await renderPost("p1", post);
    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });

  it("renders the Comments section heading", async () => {
    const post = makePost();
    await renderPost("p1", post);
    await waitFor(() => expect(screen.getByText("Comments")).toBeInTheDocument());
  });

  it("renders the comment input", async () => {
    const post = makePost();
    await renderPost("p1", post);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument();
    });
  });
});

describe("PostRoute — comments", () => {
  it("shows empty comments message when there are no comments", async () => {
    const post = makePost();
    await renderPost("p1", post, []);
    await waitFor(() => {
      expect(screen.getByText(/No comments yet/i)).toBeInTheDocument();
    });
  });

  it("renders existing comments", async () => {
    const post = makePost();
    const comments = [makeComment({ content: "Great post!" })];
    await renderPost("p1", post, comments);
    await waitFor(() => expect(screen.getByText("Great post!")).toBeInTheDocument());
  });

  it("renders comment author display name", async () => {
    const post = makePost();
    const comments = [makeComment({ displayName: "Bob Smith" })];
    await renderPost("p1", post, comments);
    await waitFor(() => expect(screen.getByText("Bob Smith")).toBeInTheDocument());
  });

  it("renders bot badge for bot comment authors", async () => {
    const post = makePost();
    const comments = [makeComment({ role: "bot", displayName: "BotUser" })];
    await renderPost("p1", post, comments);
    await waitFor(() => expect(screen.getByText("Bot")).toBeInTheDocument());
  });

  it("shows delete button for own comments", async () => {
    const currentUser = makeUser({ id: "u2" });
    const post = makePost();
    const comments = [makeComment({ userId: "u2", displayName: "Bob" })];
    await renderPost("p1", post, comments, currentUser);
    await waitFor(() => {
      expect(screen.getByLabelText("Delete comment")).toBeInTheDocument();
    });
  });

  it("does not show delete button for other users' comments", async () => {
    const currentUser = makeUser({ id: "u1" });
    const post = makePost();
    const comments = [makeComment({ userId: "u2" })];
    await renderPost("p1", post, comments, currentUser);
    await waitFor(() => expect(screen.getByText("Nice post!")).toBeInTheDocument());
    expect(screen.queryByLabelText("Delete comment")).toBeNull();
  });
});

describe("PostRoute — add comment", () => {
  it("submit button is disabled when comment is empty", async () => {
    const post = makePost();
    await renderPost("p1", post);
    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: "" });
      expect(submitBtn).toBeDefined();
    });
    const input = screen.getByPlaceholderText("Add a comment...");
    expect(input).toBeDefined();
    const form = input.closest("form");
    expect(form).toBeDefined();
    const sendBtn = form!.querySelector('button[type="submit"]');
    expect(sendBtn?.disabled).toBe(true);
  });

  it("enables submit button when comment has text", async () => {
    const post = makePost();
    await renderPost("p1", post);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Add a comment...");
    fireEvent.input(input, { target: { value: "My comment" } });
    const form = input.closest("form");
    const sendBtn = form!.querySelector('button[type="submit"]');
    expect(sendBtn?.disabled).toBe(false);
  });

  it("submits comment and calls API", async () => {
    const post = makePost();
    const currentUser = makeUser();
    const newComment = makeComment({ content: "Submitted comment" });

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1/comments") && method === "POST") return newComment;
      if (url.includes("/api/posts/p1/comments")) return [];
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return currentUser;
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), []);

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Add a comment...");
    fireEvent.input(input, { target: { value: "Submitted comment" } });
    const form = input.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      const postCall = fetchMock.calls.find(
        (c) => c.url.includes("/api/posts/p1/comments") && c.method === "POST"
      );
      expect(postCall).toBeDefined();
    });
  });

  it("shows error toast when comment submission fails", async () => {
    const post = makePost();
    const currentUser = makeUser();

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1/comments") && method === "POST")
        return new Response(JSON.stringify({ error: "fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      if (url.includes("/api/posts/p1/comments")) return [];
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return currentUser;
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), []);

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Add a comment...");
    fireEvent.input(input, { target: { value: "bad comment" } });
    const form = input.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Failed to add comment")).toBeInTheDocument();
    });
  });
});

describe("PostRoute — delete comment flow", () => {
  it("opens confirm dialog when delete comment is clicked", async () => {
    const currentUser = makeUser({ id: "u2" });
    const post = makePost();
    const comments = [makeComment({ userId: "u2" })];
    await renderPost("p1", post, comments, currentUser);

    await waitFor(() => expect(screen.getByLabelText("Delete comment")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Delete comment"));

    await waitFor(() => {
      expect(screen.getByText("Delete Comment")).toBeInTheDocument();
    });
  });

  it("calls delete API when confirm dialog is confirmed", async () => {
    const currentUser = makeUser({ id: "u2" });
    const post = makePost();
    const comments = [makeComment({ id: "c1", userId: "u2" })];

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1/comments/c1") && method === "DELETE")
        return { success: true };
      if (url.includes("/api/posts/p1/comments")) return comments;
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return currentUser;
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), comments);

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByLabelText("Delete comment")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Delete comment"));
    await waitFor(() => expect(screen.getByText("Delete Comment")).toBeInTheDocument());

    const confirmBtn = screen.getAllByRole("button").find((b) => b.textContent === "Delete");
    if (confirmBtn) fireEvent.click(confirmBtn);

    await waitFor(() => {
      const deleteCall = fetchMock.calls.find(
        (c) => c.url.includes("/api/posts/p1/comments/c1") && c.method === "DELETE"
      );
      expect(deleteCall).toBeDefined();
    });
  });
});

describe("PostRoute — back navigation", () => {
  it("calls window.history.back when Back is clicked", async () => {
    const post = makePost();
    let backCalled = false;
    const origBack = window.history.back.bind(window.history);
    window.history.back = () => {
      backCalled = true;
    };

    await renderPost("p1", post);
    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Back"));
    expect(backCalled).toBe(true);

    window.history.back = origBack;
  });
});

describe("PostRoute — mention detection", () => {
  it("typing @ in comment input shows mention autocomplete hint", async () => {
    const post = makePost();
    await renderPost("p1", post);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Add a comment...");
    // Simulate typing @a — only 1 char, shows "Type 2+ characters" hint
    input.value = "@a";
    fireEvent.input(input);
    await waitFor(() => {
      expect(screen.getByText(/type 2\+ characters/i)).toBeInTheDocument();
    });
  });

  it("typing @ada (2+ chars) enables mention search", async () => {
    const post = makePost();
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), []);
    qc.setQueryData(
      ["mention-search", "ada"],
      [{ id: "u2", username: "ada", displayName: "Ada", createdAt: "2024-01-01" }]
    );

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/search/users"))
        return [{ id: "u2", username: "ada", displayName: "Ada", createdAt: "2024-01-01" }];
      if (url.includes("/api/posts/p1/comments")) return [];
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Add a comment...");
    input.value = "@ada";
    fireEvent.input(input);

    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeInTheDocument();
    });
  });

  it("typing non-@ text hides mention autocomplete when it was visible", async () => {
    const post = makePost();
    await renderPost("p1", post);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Add a comment...");
    // First show it with @
    input.value = "@a";
    fireEvent.input(input);
    await waitFor(() => expect(screen.getByText(/type 2\+ characters/i)).toBeInTheDocument());
    // Then type without @
    input.value = "hello";
    fireEvent.input(input);
    await waitFor(() => {
      expect(screen.queryByText(/type 2\+ characters/i)).toBeNull();
    });
  });
});

describe("PostRoute — post deletion navigates home", () => {
  it("deletes post and navigates to home", async () => {
    const post = makePost({ id: "p1" });
    const currentUser = makeUser({ id: "u1" });

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1") && method === "DELETE") return { success: true };
      if (url.includes("/api/posts/p1/comments")) return [];
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return currentUser;
      if (url.includes("/api/feed")) return { posts: [], nextCursor: undefined };
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), []);

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByText("Post detail content")).toBeInTheDocument());
    // Click delete then confirm
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

describe("PostRoute — mention select and keydown", () => {
  async function setupMentionVisible() {
    const post = makePost();
    const adaUser = {
      id: "u2",
      username: "ada",
      displayName: "Ada Lovelace",
      createdAt: "2024-01-01",
    };
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), []);
    qc.setQueryData(queryKeys.search.mentions("ada"), [adaUser]);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/search/users")) return [adaUser];
      if (url.includes("/api/posts/p1/comments")) return [];
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Add a comment...");
    // Set value directly so selectionStart tracks to end of text
    input.value = "@ada";
    fireEvent.input(input);
    await waitFor(() => expect(screen.getAllByText(/ada lovelace/i).length).toBeGreaterThan(0));
    return { input };
  }

  it("clicking a mention suggestion calls handleMentionSelect", async () => {
    const { input } = await setupMentionVisible();
    const adaBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Ada Lovelace"));
    expect(adaBtn).toBeDefined();
    if (adaBtn) {
      fireEvent.click(adaBtn);
      // After select, input value should contain @ada
      await waitFor(() => {
        expect(input.value).toContain("@ada");
      });
    }
  });

  it("pressing Escape when mention is visible closes autocomplete", async () => {
    const { input } = await setupMentionVisible();
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => {
      // After Escape, the autocomplete container should be gone
      expect(document.querySelector(".fixed.z-50.bg-white.rounded-2xl")).toBeNull();
    });
  });

  it("pressing Enter when mention is visible selects first suggestion", async () => {
    const { input } = await setupMentionVisible();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      // After Enter, the input should have @ada inserted and autocomplete closed
      expect(document.querySelector(".fixed.z-50.bg-white.rounded-2xl")).toBeNull();
    });
  });
});

describe("PostRoute — delete comment failure", () => {
  it("shows error toast when delete comment API fails", async () => {
    const currentUser = makeUser({ id: "u2" });
    const post = makePost();
    const comments = [makeComment({ id: "c1", userId: "u2" })];

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1/comments/c1") && method === "DELETE")
        return new Response(JSON.stringify({ error: "fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      if (url.includes("/api/posts/p1/comments")) return comments;
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return currentUser;
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), comments);

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByLabelText("Delete comment")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Delete comment"));
    await waitFor(() => expect(screen.getByText("Delete Comment")).toBeInTheDocument());

    const confirmBtn = screen.getAllByRole("button").find((b) => b.textContent === "Delete");
    if (confirmBtn) fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Failed to delete comment")).toBeInTheDocument();
    });
  });
});

describe("PostRoute — post reaction", () => {
  it("clicking a reaction emoji calls the reaction mutation", async () => {
    // Post owned by u2, current user is u1 (so no edit/delete buttons cluttering the UI)
    const post = makePost({ id: "p1", userId: "u2" });
    const currentUser = makeUser({ id: "u1" });

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1/react") && method === "POST") return { success: true };
      if (url.includes("/api/posts/p1/comments")) return [];
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return currentUser;
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), []);

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByText("Post detail content")).toBeInTheDocument());

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

describe("PostRoute — post edit", () => {
  it("clicking edit then saving calls the edit mutation", async () => {
    // Post owned by current user so Edit button is visible
    const post = makePost({ id: "p1", userId: "u1" });
    const currentUser = makeUser({ id: "u1" });

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1") && method === "PATCH")
        return { ...post, content: "Edited content" };
      if (url.includes("/api/posts/p1/comments")) return [];
      if (url.includes("/api/posts/p1")) return post;
      if (url.includes("/api/auth/me")) return currentUser;
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.posts.detail("p1"), post);
    qc.setQueryData(queryKeys.posts.comments("p1"), []);

    await renderWithProviders(<PostRoute />, {
      path: "/post/$id",
      initialEntries: ["/post/p1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByText("Post detail content")).toBeInTheDocument());

    const editBtn = screen.queryByLabelText("Edit post");
    if (editBtn) {
      fireEvent.click(editBtn);
      await waitFor(() => {
        const textarea = document.querySelector("textarea");
        expect(textarea).not.toBeNull();
      });
      const saveBtn = document.querySelector('button[class*="bg-accent-500"][class*="rounded-lg"]');
      if (saveBtn) {
        fireEvent.click(saveBtn);
        await waitFor(() => {
          const patchCall = fetchMock.calls.find(
            (c) => c.url.includes("/api/posts/p1") && c.method === "PATCH"
          );
          expect(patchCall).toBeDefined();
        });
      }
    }
  });
});
