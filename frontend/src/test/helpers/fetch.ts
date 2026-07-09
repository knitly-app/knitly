import { mock } from "bun:test";

export interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface MockFetchResult {
  calls: RecordedCall[];
  lastCall: () => RecordedCall | undefined;
  restore: () => void;
}

type Responder = (call: RecordedCall) => unknown;

function toResponse(value: unknown): Response {
  if (value instanceof Response) return value;
  return jsonResponse(value);
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export function errorResponse(status: number, body: unknown = { error: "error" }): Response {
  return jsonResponse(body, { status, statusText: "Error" });
}

export function mockFetch(responder: Responder | object | null): MockFetchResult {
  const original = globalThis.fetch;
  const calls: RecordedCall[] = [];

  globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => {
        headers[k] = v;
      });
    }
    let body: unknown = null;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: RecordedCall = { url, method: init?.method ?? "GET", body, headers };
    calls.push(call);
    const value = typeof responder === "function" ? (responder as Responder)(call) : responder;
    return Promise.resolve(toResponse(value));
  }) as typeof fetch;

  return {
    calls,
    lastCall: () => calls[calls.length - 1],
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
