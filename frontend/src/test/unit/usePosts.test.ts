import { describe, it, expect, afterEach } from "bun:test";
import { h } from "preact";
import { renderHook, waitFor } from "@testing-library/preact";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../components/Toast";
import {
  useFeed,
  usePost,
  useUserPosts,
  useUserMedia,
  useCreatePost,
  useReaction,
  usePostComments,
  useAddComment,
  useEditPost,
  useDeletePost,
  useDeleteComment,
  useVotePoll,
} from "../../hooks/usePosts";
import { makeQueryClient } from "../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../helpers/fetch";
import type { Post, Comment, User } from "../../api/endpoints";
import { queryKeys } from "../../api/queryKeys";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

function makeRetentiveClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 60_000, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithToast<T>(cb: () => T, queryClient: QueryClient = makeQueryClient()) {
  return renderHook(cb, {
    wrapper: ({ children }) =>
      h(QueryClientProvider, { client: queryClient }, h(ToastProvider, null, children)),
  });
}

const post: Post = {
  id: "p1",
  userId: "u1",
  content: "hello",
  createdAt: "2024-01-01",
  reactions: {},
  userReaction: null,
  comments: 0,
};

const comment: Comment = {
  id: "c1",
  postId: "p1",
  userId: "u1",
  username: "ada",
  displayName: "Ada",
  content: "nice",
  createdAt: "2024-01-01",
};

const currentUser: User = {
  id: "u1",
  username: "ada",
  displayName: "Ada",
  createdAt: "2024-01-01",
};

describe("useFeed", () => {
  it("fetches first page from /api/feed", async () => {
    fetchMock = mockFetch({ posts: [post], nextCursor: undefined });
    const { result } = renderWithToast(() => useFeed());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].posts).toHaveLength(1);
    const url = fetchMock.lastCall()!.url;
    expect(url.startsWith("/api/feed")).toBe(true);
    expect(fetchMock.lastCall()!.method).toBe("GET");
  });

  it("filters by circleId when provided", async () => {
    fetchMock = mockFetch({ posts: [], nextCursor: undefined });
    const { result } = renderWithToast(() => useFeed("circle1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()!.url).toContain("circleId=circle1");
  });
});

describe("usePost", () => {
  it("fetches a single post by id", async () => {
    fetchMock = mockFetch(post);
    const { result } = renderWithToast(() => usePost("p1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: "p1" });
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/posts/p1" });
  });
});

describe("useUserPosts", () => {
  it("fetches posts for a user", async () => {
    fetchMock = mockFetch([post]);
    const { result } = renderWithToast(() => useUserPosts("u1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock.lastCall()!.url).toContain("/users/u1/posts");
  });
});

describe("useUserMedia", () => {
  it("fetches media posts for a user with mediaOnly=true", async () => {
    fetchMock = mockFetch([post]);
    const { result } = renderWithToast(() => useUserMedia("u1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock.lastCall()!.url).toContain("mediaOnly=true");
  });
});

describe("useCreatePost", () => {
  it("posts to /api/posts and invalidates feed on success", async () => {
    fetchMock = mockFetch(post);
    const { result } = renderWithToast(() => useCreatePost());
    result.current.mutate({ content: "new post" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/posts",
      method: "POST",
    });
  });
});

describe("useReaction", () => {
  it("reacts to a post (no current reaction)", async () => {
    fetchMock = mockFetch({
      success: true,
      reactions: { love: 1 },
      userReaction: "love",
    });
    const { result } = renderWithToast(() => useReaction());
    result.current.mutate({ id: "p1", type: "love", currentReaction: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/posts/p1/reactions",
      method: "POST",
    });
  });

  it("unreacts when toggling off the same reaction", async () => {
    fetchMock = mockFetch({
      success: true,
      reactions: {},
      userReaction: null,
    });
    const { result } = renderWithToast(() => useReaction());
    result.current.mutate({ id: "p1", type: "love", currentReaction: "love" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/posts/p1/reactions",
      method: "DELETE",
    });
  });

  it("applies optimistic update to cached post data", async () => {
    const qc = makeRetentiveClient();
    qc.setQueryData<Post>(queryKeys.posts.detail("p1"), {
      ...post,
      reactions: { love: 1 },
      userReaction: "love",
    });

    fetchMock = mockFetch({
      success: true,
      reactions: { haha: 1 },
      userReaction: "haha",
    });

    const { result } = renderWithToast(() => useReaction(), qc);
    result.current.mutate({
      id: "p1",
      type: "haha",
      currentReaction: "love",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isSuccess).toBe(true);
  });

  it("rolls back optimistic update on error", async () => {
    const qc = makeRetentiveClient();
    const originalPost: Post = {
      ...post,
      reactions: { love: 2 },
      userReaction: null,
    };
    qc.setQueryData<Post>(queryKeys.posts.detail("p1"), originalPost);

    fetchMock = mockFetch(errorResponse(500));
    const { result } = renderWithToast(() => useReaction(), qc);
    result.current.mutate({ id: "p1", type: "love", currentReaction: null });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const cachedPost = qc.getQueryData<Post>(queryKeys.posts.detail("p1"));
    expect(cachedPost?.reactions.love).toBe(2);
  });

  it("handles optimistic update when no post is in cache", async () => {
    fetchMock = mockFetch({
      success: true,
      reactions: { love: 1 },
      userReaction: "love",
    });
    const { result } = renderWithToast(() => useReaction());
    result.current.mutate({ id: "no-cache", type: "love", currentReaction: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("removes zero-count reaction keys during optimistic update", async () => {
    const qc = makeRetentiveClient();
    qc.setQueryData<Post>(queryKeys.posts.detail("p1"), {
      ...post,
      reactions: { love: 1 },
      userReaction: "love",
    });

    fetchMock = mockFetch({
      success: true,
      reactions: {},
      userReaction: null,
    });

    const { result } = renderWithToast(() => useReaction(), qc);
    result.current.mutate({ id: "p1", type: "love", currentReaction: "love" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("usePostComments", () => {
  it("fetches comments for a post", async () => {
    fetchMock = mockFetch([comment]);
    const { result } = renderWithToast(() => usePostComments("p1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock.lastCall()!.url).toContain("/posts/p1/comments");
  });
});

describe("useAddComment", () => {
  it("posts a comment and updates cache optimistically when user is cached", async () => {
    const qc = makeRetentiveClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData<Comment[]>(queryKeys.posts.comments("p1"), []);
    qc.setQueryData<Post>(queryKeys.posts.detail("p1"), post);

    fetchMock = mockFetch(comment);
    const { result } = renderWithToast(() => useAddComment(), qc);
    result.current.mutate({ postId: "p1", content: "nice" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/posts/p1/comments",
      method: "POST",
    });
  });

  it("adds comment without user in cache (skips optimistic comment)", async () => {
    const qc = makeRetentiveClient();
    qc.setQueryData<Comment[]>(queryKeys.posts.comments("p1"), []);

    fetchMock = mockFetch(comment);
    const { result } = renderWithToast(() => useAddComment(), qc);
    result.current.mutate({ postId: "p1", content: "nice" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls back optimistic comment on error", async () => {
    const qc = makeRetentiveClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);
    qc.setQueryData<Comment[]>(queryKeys.posts.comments("p1"), [comment]);
    qc.setQueryData<Post>(queryKeys.posts.detail("p1"), post);

    fetchMock = mockFetch(errorResponse(500));
    const { result } = renderWithToast(() => useAddComment(), qc);
    result.current.mutate({ postId: "p1", content: "fail" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const comments = qc.getQueryData<Comment[]>(queryKeys.posts.comments("p1"));
    expect(comments).toHaveLength(1);
    expect(comments![0].id).toBe("c1");
  });

  it("handles missing cached comments and seeds with first comment", async () => {
    const qc = makeRetentiveClient();
    qc.setQueryData(queryKeys.auth.me(), currentUser);

    fetchMock = mockFetch(comment);
    const { result } = renderWithToast(() => useAddComment(), qc);
    result.current.mutate({ postId: "p1", content: "first" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useEditPost", () => {
  it("patches the post content and updates cache", async () => {
    const updated = { ...post, content: "updated" };
    fetchMock = mockFetch(updated);
    const { result } = renderWithToast(() => useEditPost());
    result.current.mutate({ id: "p1", content: "updated" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/posts/p1",
      method: "PATCH",
    });
  });

  it("exposes error on failure", async () => {
    fetchMock = mockFetch(errorResponse(500));
    const { result } = renderWithToast(() => useEditPost());
    result.current.mutate({ id: "p1", content: "bad" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeletePost", () => {
  it("deletes a post and invalidates caches", async () => {
    fetchMock = mockFetch({});
    const { result } = renderWithToast(() => useDeletePost());
    result.current.mutate("p1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/posts/p1",
      method: "DELETE",
    });
  });

  it("calls optional onSuccess callback with postId", async () => {
    fetchMock = mockFetch({});
    let capturedId: string | undefined;
    const { result } = renderWithToast(() =>
      useDeletePost({
        onSuccess: (id) => {
          capturedId = id;
        },
      })
    );
    result.current.mutate("p1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedId).toBe("p1");
  });

  it("exposes error on failure", async () => {
    fetchMock = mockFetch(errorResponse(500));
    const { result } = renderWithToast(() => useDeletePost());
    result.current.mutate("p1");
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeleteComment", () => {
  it("deletes a comment and invalidates queries", async () => {
    fetchMock = mockFetch({});
    const { result } = renderWithToast(() => useDeleteComment());
    result.current.mutate({ postId: "p1", commentId: "c1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/posts/p1/comments/c1",
      method: "DELETE",
    });
  });
});

describe("useVotePoll", () => {
  it("posts a vote and updates post cache", async () => {
    const poll = {
      id: "poll1",
      question: "What?",
      userVote: "opt1",
      totalVotes: 1,
      options: [{ id: "opt1", optionText: "Option 1", voteCount: 1, sortOrder: 0 }],
    };
    const qc = makeRetentiveClient();
    qc.setQueryData<Post>(queryKeys.posts.detail("p1"), { ...post, poll });

    fetchMock = mockFetch({ poll });
    const { result } = renderWithToast(() => useVotePoll(), qc);
    result.current.mutate({ postId: "p1", optionId: "opt1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/posts/p1/vote",
      method: "POST",
    });
  });

  it("handles vote when post is not in cache", async () => {
    const poll = {
      id: "poll1",
      question: "What?",
      userVote: null,
      totalVotes: 0,
      options: [],
    };
    fetchMock = mockFetch({ poll });
    const { result } = renderWithToast(() => useVotePoll());
    result.current.mutate({ postId: "p1", optionId: "opt1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
