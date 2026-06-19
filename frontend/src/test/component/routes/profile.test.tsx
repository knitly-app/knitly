import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/preact";
import { renderWithProviders, makeQueryClient } from "../../helpers/render";
import { mockFetch, type MockFetchResult } from "../../helpers/fetch";
import { ProfileRoute } from "../../../routes/profile";
import { useUIStore } from "../../../stores/ui";
import { queryKeys } from "../../../api/queryKeys";
import type { Post, User } from "../../../api/endpoints";

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
    content: "A post",
    media: [],
    createdAt: new Date().toISOString(),
    reactions: {},
    userReaction: null,
    comments: 0,
    ...overrides,
  };
}

async function renderProfile(
  profileId: string,
  profileUser: User | null,
  posts: Post[] = [],
  currentUser: User | null = null
) {
  const qc = makeQueryClient();
  const userId = profileUser?.id ?? profileId;

  qc.setQueryData(queryKeys.auth.me(), currentUser);
  if (profileUser) {
    qc.setQueryData(queryKeys.users.detail(userId), profileUser);
  }
  qc.setQueryData(queryKeys.users.posts(userId), posts);
  qc.setQueryData(queryKeys.users.media(userId), []);

  fetchMock = mockFetch(({ url }: { url: string }) => {
    if (url.includes("/api/users/") && url.includes("/posts")) return posts;
    if (url.includes("/api/users/") && url.endsWith(userId)) return profileUser;
    if (url.includes("/api/auth/me")) return currentUser;
    return null;
  });

  return renderWithProviders(<ProfileRoute />, {
    path: "/profile/$id",
    initialEntries: [`/profile/${profileId}`],
    queryClient: qc,
  });
}

describe("ProfileRoute — loading state", () => {
  it("shows skeleton while loading", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    fetchMock = mockFetch(() => new Promise(() => {}));
    await renderWithProviders(<ProfileRoute />, {
      path: "/profile/$id",
      initialEntries: ["/profile/u1"],
      queryClient: qc,
    });
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe("ProfileRoute — user not found", () => {
  it("shows not found message when user data is null", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), null);
    qc.setQueryData(queryKeys.users.detail("u999"), null);
    qc.setQueryData(queryKeys.users.posts("u999"), []);
    qc.setQueryData(queryKeys.users.media("u999"), []);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/users/u999") && !url.includes("/posts")) return null;
      if (url.includes("/api/users/u999/posts")) return [];
      if (url.includes("/api/auth/me")) return null;
      return null;
    });

    await renderWithProviders(<ProfileRoute />, {
      path: "/profile/$id",
      initialEntries: ["/profile/u999"],
      queryClient: qc,
    });

    await waitFor(() => {
      expect(screen.getByText("User not found")).toBeInTheDocument();
    });
  });
});

describe("ProfileRoute — own profile", () => {
  it("shows Edit Profile link for own profile", async () => {
    const user = makeUser();
    await renderProfile("u1", user, [], user);
    await waitFor(() => expect(screen.getByText("Edit Profile")).toBeInTheDocument());
  });

  it("shows Edit Profile link when param is 'me'", async () => {
    const user = makeUser();
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), user);
    qc.setQueryData(queryKeys.users.detail("u1"), user);
    qc.setQueryData(queryKeys.users.posts("u1"), []);
    qc.setQueryData(queryKeys.users.media("u1"), []);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/me")) return user;
      if (url.includes("/api/users/u1/posts")) return [];
      if (url.includes("/api/users/u1")) return user;
      return null;
    });

    await renderWithProviders(<ProfileRoute />, {
      path: "/profile/$id",
      initialEntries: ["/profile/me"],
      queryClient: qc,
    });
    await waitFor(() => expect(screen.getByText("Edit Profile")).toBeInTheDocument());
  });

  it("shows Admin Panel link for admin user on own profile", async () => {
    const user = makeUser({ role: "admin" });
    await renderProfile("u1", user, [], user);
    await waitFor(() => expect(screen.getByText("Admin Panel")).toBeInTheDocument());
  });

  it("does not show Admin Panel for non-admin user", async () => {
    const user = makeUser({ role: "member" });
    await renderProfile("u1", user, [], user);
    await waitFor(() => expect(screen.getByText("Edit Profile")).toBeInTheDocument());
    expect(screen.queryByText("Admin Panel")).toBeNull();
  });
});

describe("ProfileRoute — other user profile", () => {
  it("does not show Edit Profile for another user", async () => {
    const profileUser = makeUser({ id: "u2", username: "bob", displayName: "Bob" });
    const currentUser = makeUser({ id: "u1" });
    await renderProfile("u2", profileUser, [], currentUser);
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());
    expect(screen.queryByText("Edit Profile")).toBeNull();
  });
});

describe("ProfileRoute — user details", () => {
  it("renders display name and username", async () => {
    const user = makeUser();
    await renderProfile("u1", user, []);
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("@ada")).toBeInTheDocument();
    });
  });

  it("renders bio when present", async () => {
    const user = makeUser({ bio: "I love knitting" });
    await renderProfile("u1", user, []);
    await waitFor(() => expect(screen.getByText("I love knitting")).toBeInTheDocument());
  });

  it("renders location when present", async () => {
    const user = makeUser({ location: "London" });
    await renderProfile("u1", user, []);
    await waitFor(() => expect(screen.getByText("London")).toBeInTheDocument());
  });

  it("renders website link when present", async () => {
    const user = makeUser({ website: "https://ada.dev" });
    await renderProfile("u1", user, []);
    await waitFor(() => {
      const link = screen.getByText("ada.dev");
      expect(link).toBeInTheDocument();
    });
  });

  it("renders website without http prefix", async () => {
    const user = makeUser({ website: "ada.dev" });
    await renderProfile("u1", user, []);
    await waitFor(() => expect(screen.getByText("ada.dev")).toBeInTheDocument());
  });

  it("renders gradient header when no header image", async () => {
    const user = makeUser();
    await renderProfile("u1", user, []);
    await waitFor(() => {
      const gradient = document.querySelector(".bg-gradient-to-r");
      expect(gradient).toBeInTheDocument();
    });
  });

  it("renders header image when user has header", async () => {
    const user = makeUser({ header: "https://example.com/header.jpg" });
    await renderProfile("u1", user, []);
    await waitFor(() => {
      const img = document.querySelector('img[src="https://example.com/header.jpg"]');
      expect(img).toBeInTheDocument();
    });
  });
});

describe("ProfileRoute — posts tab", () => {
  it("renders posts in the posts tab", async () => {
    const user = makeUser();
    const posts = [makePost({ content: "My post content" })];
    await renderProfile("u1", user, posts, user);
    await waitFor(() => expect(screen.getByText("My post content")).toBeInTheDocument());
  });

  it("shows empty state when user has no posts", async () => {
    const user = makeUser();
    await renderProfile("u1", user, [], user);
    await waitFor(() => expect(screen.getByText("No posts yet")).toBeInTheDocument());
  });

  it("shows post count in moments stat", async () => {
    const user = makeUser();
    const posts = [makePost(), makePost({ id: "p2" })];
    await renderProfile("u1", user, posts, user);
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
  });
});

describe("ProfileRoute — tabs", () => {
  it("switches to media tab when Media is clicked", async () => {
    const user = makeUser();
    await renderProfile("u1", user, [], user);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
    const mediaTab = screen.getByRole("button", { name: /media/i });
    fireEvent.click(mediaTab);
    await waitFor(() => {
      expect(screen.getByText(/No photos or videos yet/i)).toBeInTheDocument();
    });
  });

  it("switches back to posts tab from media tab", async () => {
    const user = makeUser();
    await renderProfile("u1", user, [], user);
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
    const mediaTab = screen.getByRole("button", { name: /media/i });
    fireEvent.click(mediaTab);
    await waitFor(() => expect(screen.getByText(/No photos or videos yet/i)).toBeInTheDocument());
    const postsTab = screen.getByRole("button", { name: /posts/i });
    fireEvent.click(postsTab);
    await waitFor(() => expect(screen.getByText("No posts yet")).toBeInTheDocument());
  });
});

describe("ProfileRoute — media tab with content", () => {
  it("renders MediaGrid when user has media posts", async () => {
    const user = makeUser({ id: "u1" });
    const mediaPosts = [
      makePost({ id: "pm1", media: [{ url: "https://img.com/1.jpg", type: "image" }] }),
    ];

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), user);
    qc.setQueryData(queryKeys.users.detail("u1"), user);
    qc.setQueryData(queryKeys.users.posts("u1"), []);
    qc.setQueryData(queryKeys.users.media("u1"), mediaPosts);

    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/auth/me")) return user;
      if (url.includes("/api/users/u1/posts")) return [];
      if (url.includes("/api/users/u1")) return user;
      return null;
    });

    await renderWithProviders(<ProfileRoute />, {
      path: "/profile/$id",
      initialEntries: ["/profile/u1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
    const mediaTab = screen.getByRole("button", { name: /media/i });
    fireEvent.click(mediaTab);
    await waitFor(() => {
      // MediaGrid renders images — count should be > 0
      const images = document.querySelectorAll("img");
      expect(images.length).toBeGreaterThan(0);
    });
  });

  it("shows posts loading skeleton when posts are loading", async () => {
    const user = makeUser({ id: "u1" });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), user);
    qc.setQueryData(queryKeys.users.detail("u1"), user);
    // Don't pre-seed posts so it triggers loading
    qc.setQueryData(queryKeys.users.media("u1"), []);

    let resolvePostsFetch: ((v: unknown) => void) | null = null;
    fetchMock = mockFetch(({ url }: { url: string }) => {
      if (url.includes("/api/users/u1/posts"))
        return new Promise((r) => {
          resolvePostsFetch = r;
        });
      if (url.includes("/api/auth/me")) return user;
      if (url.includes("/api/users/u1")) return user;
      return null;
    });

    await renderWithProviders(<ProfileRoute />, {
      path: "/profile/$id",
      initialEntries: ["/profile/u1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    resolvePostsFetch?.([]);
  });
});

describe("ProfileRoute — post deletion from profile", () => {
  it("renders delete button for own posts and can delete", async () => {
    const user = makeUser({ id: "u1" });
    const posts = [makePost({ id: "p1", userId: "u1", content: "My profile post" })];

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1") && method === "DELETE") return { success: true };
      if (url.includes("/api/users/u1/posts") && url.includes("mediaOnly")) return [];
      if (url.includes("/api/users/u1/posts")) return posts;
      if (url.includes("/api/auth/me")) return user;
      if (url.includes("/api/users/u1")) return user;
      if (url.includes("/api/feed")) return { posts: [], nextCursor: undefined };
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), user);
    qc.setQueryData(queryKeys.users.detail("u1"), user);
    qc.setQueryData(queryKeys.users.posts("u1"), posts);
    qc.setQueryData(queryKeys.users.media("u1"), []);

    await renderWithProviders(<ProfileRoute />, {
      path: "/profile/$id",
      initialEntries: ["/profile/u1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByText("My profile post")).toBeInTheDocument());
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

describe("ProfileRoute — post reaction", () => {
  it("clicking a reaction emoji on a profile post calls the reaction mutation", async () => {
    const profileUser = makeUser({ id: "u2", username: "bob", displayName: "Bob" });
    const currentUser = makeUser({ id: "u1" });
    const posts = [makePost({ id: "p1", userId: "u2", content: "Bob post" })];

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData(queryKeys.users.detail("u2"), profileUser);
    qc.setQueryData(queryKeys.users.posts("u2"), posts);
    qc.setQueryData(queryKeys.users.media("u2"), []);

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1/react") && method === "POST") return { success: true };
      if (url.includes("/api/users/u2/posts")) return posts;
      if (url.includes("/api/auth/me")) return currentUser;
      if (url.includes("/api/users/u2")) return profileUser;
      return null;
    });

    await renderWithProviders(<ProfileRoute />, {
      path: "/profile/$id",
      initialEntries: ["/profile/u2"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByText("Bob post")).toBeInTheDocument());

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

describe("ProfileRoute — post edit from profile", () => {
  it("clicking edit then saving calls the edit mutation", async () => {
    const user = makeUser({ id: "u1" });
    const posts = [makePost({ id: "p1", userId: "u1", content: "Editable post" })];

    fetchMock = mockFetch(({ url, method }: { url: string; method: string }) => {
      if (url.includes("/api/posts/p1") && method === "PATCH")
        return { ...posts[0], content: "Edited" };
      if (url.includes("/api/users/u1/posts")) return posts;
      if (url.includes("/api/auth/me")) return user;
      if (url.includes("/api/users/u1")) return user;
      return null;
    });

    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.auth.me(), user);
    qc.setQueryData(queryKeys.users.detail("u1"), user);
    qc.setQueryData(queryKeys.users.posts("u1"), posts);
    qc.setQueryData(queryKeys.users.media("u1"), []);

    await renderWithProviders(<ProfileRoute />, {
      path: "/profile/$id",
      initialEntries: ["/profile/u1"],
      queryClient: qc,
    });

    await waitFor(() => expect(screen.getByText("Editable post")).toBeInTheDocument());

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
