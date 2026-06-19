import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { api, ApiError } from "../../api/client";

const originalFetch = globalThis.fetch;

describe("api client", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("makes GET requests with credentials", async () => {
    const mockResponse = { id: "1", name: "Test" };
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    );

    const result = await api.get("/users/1");

    expect(fetch).toHaveBeenCalledWith("/api/users/1", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    expect(result).toEqual(mockResponse);
  });

  it("makes POST requests with body", async () => {
    const payload = { email: "test@test.com", password: "pass" };
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: "abc" }),
      } as Response)
    );

    await api.post("/auth/login", payload);

    expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  });

  it("makes PUT requests with body", async () => {
    const payload = { appName: "Knitly" };
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as Response)
    );

    await api.put("/settings", payload);

    expect(fetch).toHaveBeenCalledWith("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  });

  it("makes PATCH requests with body", async () => {
    const payload = { displayName: "Alice" };
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as Response)
    );

    await api.patch("/users/1", payload);

    expect(fetch).toHaveBeenCalledWith("/api/users/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  });

  it("throws ApiError on non-ok response with parseable body", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () => Promise.resolve({ error: "invalid credentials" }),
      } as Response)
    );

    let error: unknown;
    try {
      await api.get("/auth/me");
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).body).toEqual({ error: "invalid credentials" });
  });

  it("throws ApiError with undefined body when response body is not parseable JSON", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new SyntaxError("unexpected token")),
      } as unknown as Response)
    );

    let error: unknown;
    try {
      await api.get("/broken");
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).body).toBeUndefined();
  });

  it("handles 204 No Content", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 204,
      } as Response)
    );

    const result = await api.delete("/posts/1");

    expect(result).toBeUndefined();
  });

  it("serializes query params", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    );

    await api.get("/search/users", { params: { q: "mike" } });

    expect(fetch).toHaveBeenCalledWith("/api/search/users?q=mike", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
  });
});
