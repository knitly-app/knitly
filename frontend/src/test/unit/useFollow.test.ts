import { describe, it, expect, afterEach } from "bun:test";
import { useFollow } from "../../hooks/useFollow";
import { renderHookWithClient, waitFor } from "../helpers/render";
import { mockFetch, type MockFetchResult } from "../helpers/fetch";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

describe("useFollow", () => {
  it("follow posts to the follow endpoint", async () => {
    fetchMock = mockFetch({ success: true });
    const { result } = renderHookWithClient(() => useFollow("u1"));
    result.current.follow();
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(0));
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/users/u1/follow",
      method: "POST",
    });
  });

  it("unfollow issues a DELETE", async () => {
    fetchMock = mockFetch({ success: true });
    const { result } = renderHookWithClient(() => useFollow("u1"));
    result.current.unfollow();
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(0));
    expect(fetchMock.lastCall()!.method).toBe("DELETE");
  });

  it("toggle follows when not following and unfollows when following", async () => {
    fetchMock = mockFetch({ success: true });
    const { result } = renderHookWithClient(() => useFollow("u1"));
    result.current.toggle(false);
    await waitFor(() => expect(fetchMock.lastCall()!.method).toBe("POST"));
    result.current.toggle(true);
    await waitFor(() => expect(fetchMock.lastCall()!.method).toBe("DELETE"));
  });
});
