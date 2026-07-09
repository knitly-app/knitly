import { describe, it, expect, afterEach } from "bun:test";
import { h } from "preact";
import { renderHook, waitFor } from "@testing-library/preact";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../components/Toast";
import {
  useCircles,
  useCircle,
  useCreateCircle,
  useUpdateCircle,
  useDeleteCircle,
  useAddCircleMember,
  useRemoveCircleMember,
  MAX_CIRCLES,
} from "../../hooks/useCircles";
import { makeQueryClient } from "../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../helpers/fetch";
import type { Circle, CircleWithMembers } from "../../api/endpoints";
import { queryKeys } from "../../api/queryKeys";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

function renderWithToast<T>(cb: () => T, queryClient: QueryClient = makeQueryClient()) {
  return renderHook(cb, {
    wrapper: ({ children }) =>
      h(QueryClientProvider, { client: queryClient }, h(ToastProvider, null, children)),
  });
}

const circle: Circle = {
  id: "c1",
  userId: "u1",
  name: "Friends",
  color: "#ff0000",
  createdAt: "2024-01-01",
  memberCount: 2,
};

const circleWithMembers: CircleWithMembers = {
  ...circle,
  members: [],
};

describe("useCircles", () => {
  it("fetches the circles list from /api/circles", async () => {
    fetchMock = mockFetch([circle]);
    const { result } = renderWithToast(() => useCircles());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/circles", method: "GET" });
  });

  it("canCreateCircle is true when below the limit", async () => {
    fetchMock = mockFetch([circle]);
    const { result } = renderWithToast(() => useCircles());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.canCreateCircle).toBe(true);
  });

  it("canCreateCircle is false when at the limit", async () => {
    const full = Array.from({ length: MAX_CIRCLES }, (_, i) => ({
      ...circle,
      id: String(i),
    }));
    fetchMock = mockFetch(full);
    const { result } = renderWithToast(() => useCircles());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.canCreateCircle).toBe(false);
  });

  it("canCreateCircle defaults to true when data is not yet loaded", () => {
    fetchMock = mockFetch(errorResponse(500));
    const { result } = renderWithToast(() => useCircles());
    expect(result.current.canCreateCircle).toBe(true);
  });
});

describe("useCircle", () => {
  it("fetches a single circle by id", async () => {
    fetchMock = mockFetch(circleWithMembers);
    const { result } = renderWithToast(() => useCircle("c1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: "c1" });
    expect(fetchMock.lastCall()!.url).toContain("/circles/c1");
  });
});

describe("useCreateCircle", () => {
  it("creates a circle when under the limit", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), [] as Circle[]);
    fetchMock = mockFetch(circleWithMembers);
    const { result } = renderWithToast(() => useCreateCircle(), qc);
    result.current.mutate({ name: "Friends", color: "#ff0000" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/circles", method: "POST" });
  });

  it("throws when at MAX_CIRCLES and skips the API call", async () => {
    const qc = makeQueryClient();
    const full = Array.from({ length: MAX_CIRCLES }, (_, i) => ({ ...circle, id: String(i) }));
    qc.setQueryData(queryKeys.circles.all(), full);
    fetchMock = mockFetch(circleWithMembers);
    const { result } = renderWithToast(() => useCreateCircle(), qc);
    result.current.mutate({ name: "Fifth Circle" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("surfaces API error via onError", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.circles.all(), [] as Circle[]);
    fetchMock = mockFetch(errorResponse(500));
    const { result } = renderWithToast(() => useCreateCircle(), qc);
    result.current.mutate({ name: "Friends" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateCircle", () => {
  it("patches circle data", async () => {
    fetchMock = mockFetch({ ...circleWithMembers, name: "Updated" });
    const { result } = renderWithToast(() => useUpdateCircle());
    result.current.mutate({ id: "c1", name: "Updated" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/circles/c1", method: "PATCH" });
  });

  it("surfaces error via onError", async () => {
    fetchMock = mockFetch(errorResponse(500));
    const { result } = renderWithToast(() => useUpdateCircle());
    result.current.mutate({ id: "c1", name: "Fail" });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeleteCircle", () => {
  it("deletes a circle", async () => {
    fetchMock = mockFetch({});
    const { result } = renderWithToast(() => useDeleteCircle());
    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({ url: "/api/circles/c1", method: "DELETE" });
  });

  it("surfaces error via onError", async () => {
    fetchMock = mockFetch(errorResponse(500));
    const { result } = renderWithToast(() => useDeleteCircle());
    result.current.mutate("c1");
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useAddCircleMember", () => {
  it("posts user ids to circle members endpoint", async () => {
    fetchMock = mockFetch({ success: true, added: 1 });
    const { result } = renderWithToast(() => useAddCircleMember());
    result.current.mutate({ circleId: "c1", userIds: [42] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/circles/c1/members",
      method: "POST",
    });
  });
});

describe("useRemoveCircleMember", () => {
  it("deletes a user from circle members", async () => {
    fetchMock = mockFetch({});
    const { result } = renderWithToast(() => useRemoveCircleMember());
    result.current.mutate({ circleId: "c1", userId: "u2" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/circles/c1/members/u2",
      method: "DELETE",
    });
  });
});
