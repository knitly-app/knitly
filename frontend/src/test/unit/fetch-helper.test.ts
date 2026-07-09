import { describe, it, expect, afterEach } from "bun:test";
import { mockFetch, jsonResponse, errorResponse, type MockFetchResult } from "../helpers/fetch";

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

describe("fetch helper", () => {
  it("errorResponse defaults the body to a generic error", async () => {
    const res = errorResponse(500);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "error" });
  });

  it("jsonResponse serializes undefined as an empty body", async () => {
    const res = jsonResponse(undefined);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("records the url from a URL object input", async () => {
    fetchMock = mockFetch({ ok: true });
    await fetch(new URL("https://example.com/api/x"));
    expect(fetchMock.lastCall()!.url).toBe("https://example.com/api/x");
  });

  it("records the url from a Request input", async () => {
    fetchMock = mockFetch({ ok: true });
    await fetch(new Request("https://example.com/api/y", { method: "DELETE" }));
    const call = fetchMock.lastCall()!;
    expect(call.url).toBe("https://example.com/api/y");
  });

  it("returns a Response passed straight through by the responder", async () => {
    fetchMock = mockFetch(() => new Response("hi", { status: 201 }));
    const res = await fetch("/whatever");
    expect(res.status).toBe(201);
    expect(await res.text()).toBe("hi");
  });

  it("lastCall is undefined before any call", () => {
    fetchMock = mockFetch({});
    expect(fetchMock.lastCall()).toBeUndefined();
  });
});
