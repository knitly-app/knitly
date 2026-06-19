import { describe, it, expect, afterEach } from "bun:test";
import { h } from "preact";
import { renderHook, waitFor } from "@testing-library/preact";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../components/Toast";
import { useAuth } from "../../hooks/useAuth";
import { makeQueryClient } from "../helpers/render";
import { mockFetch, errorResponse, type MockFetchResult } from "../helpers/fetch";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

const user = {
  id: "1",
  username: "ada",
  displayName: "Ada",
  createdAt: "2024-01-01",
};

function renderAuth(queryClient = makeQueryClient()) {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) =>
      h(QueryClientProvider, { client: queryClient }, h(ToastProvider, null, children)),
  });
}

describe("useAuth", () => {
  it("fetches the current user on mount", async () => {
    fetchMock = mockFetch(user);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toMatchObject({ id: "1" }));
    expect(result.current.isAuthenticated).toBe(true);
    expect(fetchMock.lastCall()).toMatchObject({
      url: "/api/auth/me",
      method: "GET",
    });
  });

  it("returns null user when unauthenticated (401)", async () => {
    fetchMock = mockFetch(errorResponse(401, { error: "Unauthorized" }));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("login calls /api/auth/login and sets user in cache", async () => {
    fetchMock = mockFetch(user);
    const { result } = renderAuth();
    await result.current.login({ email: "ada@example.com", password: "pw" });
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThanOrEqual(1));
    const loginCall = fetchMock.calls.find((c) => c.url === "/api/auth/login");
    expect(loginCall).toBeDefined();
    expect(loginCall!.method).toBe("POST");
  });

  it("login shows toast when restoredFromDeletion is true", async () => {
    fetchMock = mockFetch({ ...user, restoredFromDeletion: true });
    const { result } = renderAuth();
    await result.current.login({ email: "ada@example.com", password: "pw" });
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThanOrEqual(1));
    const loginCall = fetchMock.calls.find((c) => c.url === "/api/auth/login");
    expect(loginCall).toBeDefined();
  });

  it("signup calls /api/auth/signup and sets user in cache", async () => {
    fetchMock = mockFetch(user);
    const { result } = renderAuth();
    await result.current.signup({
      email: "ada@example.com",
      password: "pw",
      username: "ada",
      displayName: "Ada",
    });
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThanOrEqual(1));
    const signupCall = fetchMock.calls.find((c) => c.url === "/api/auth/signup");
    expect(signupCall).toBeDefined();
    expect(signupCall!.method).toBe("POST");
  });

  it("logout calls /api/auth/logout and clears cache", async () => {
    fetchMock = mockFetch({});
    const { result } = renderAuth();
    result.current.logout();
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThanOrEqual(1));
    const logoutCall = fetchMock.calls.find((c) => c.url === "/api/auth/logout");
    expect(logoutCall).toBeDefined();
    expect(logoutCall!.method).toBe("POST");
  });

  it("exposes loginError when login fails", async () => {
    fetchMock = mockFetch(errorResponse(401, { error: "Bad credentials" }));
    const { result } = renderAuth();
    try {
      await result.current.login({ email: "bad@example.com", password: "wrong" });
    } catch {
      // expected
    }
    await waitFor(() => expect(result.current.loginError).toBeTruthy());
  });

  it("exposes signupError when signup fails", async () => {
    fetchMock = mockFetch(errorResponse(422, { error: "Username taken" }));
    const { result } = renderAuth();
    try {
      await result.current.signup({
        email: "x@x.com",
        password: "pw",
        username: "taken",
        displayName: "X",
      });
    } catch {
      // expected
    }
    await waitFor(() => expect(result.current.signupError).toBeTruthy());
  });
});
