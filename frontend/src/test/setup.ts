import { afterEach, expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/preact";

expect.extend(matchers);

// happy-dom's native fetch throws on relative URLs ("about:blank" origin). Components
// fire-and-forget requests on unmount (e.g. chat presence `leave()`), which can land
// after a test restores fetch. Install a benign default so those leaked calls resolve
// quietly instead of raising an unhandled relative-URL DOMException. mockFetch restores
// to whatever was here before it ran, i.e. this stub.
globalThis.fetch = (() =>
  Promise.resolve(
    new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })
  )) as typeof fetch;

afterEach(() => {
  cleanup();
});
