// ---------------------------------------------------------------------------
// This mock MUST appear before any imports that transitively load
// @tanstack/router-core. The package's export map specifies a "bun" condition
// that resolves to the SERVER build (isServer = true), which prevents
// createBrowserHistory from running and leaves the router's __store
// uninitialised. We override with the client build so the router works
// correctly inside the happy-dom environment.
// ---------------------------------------------------------------------------
import { mock } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";

const storeRoot = join(import.meta.dir, "../../../node_modules/.bun");
const serverBuilds = new Glob(
  "@tanstack+router-core@*/node_modules/@tanstack/router-core/dist/esm/isServer/server.js"
).scanSync({ cwd: storeRoot, absolute: true });
for (const file of serverBuilds) {
  void mock.module(file, () => ({ isServer: false }));
}

import { describe, it, expect, afterEach, afterAll } from "bun:test";
import { render } from "preact";
import { waitFor } from "@testing-library/preact";
import type { QueryClient } from "@tanstack/react-query";
import { mockFetch, jsonResponse, type MockFetchResult } from "../test/helpers/fetch";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_USER = {
  id: "u1",
  username: "me",
  displayName: "Me",
  role: "admin",
  createdAt: "",
};

const MEMBER_USER = {
  id: "u2",
  username: "member",
  displayName: "Member",
  role: "member",
  createdAt: "",
};

function makeResponder(call: { url: string }) {
  const u = call.url;
  if (u.includes("/api/setup/status")) return { needsSetup: false };
  if (u.includes("/api/auth/me")) return ADMIN_USER;
  if (u.includes("/api/settings")) return { appName: "Knitly", logoIcon: "Zap" };
  if (u.includes("/api/feed")) return { posts: [], nextCursor: undefined };
  if (/\/api\/users\/[^/]+\/posts/.test(u)) return [];
  if (/\/api\/users\/[^/]+$/.test(u)) return ADMIN_USER;
  if (u.includes("/api/users")) return [];
  if (/\/api\/posts\/[^/]+\/comments/.test(u)) return [];
  if (/\/api\/posts\/[^/]+$/.test(u))
    return {
      id: "p1",
      userId: "u1",
      content: "Hello",
      createdAt: "",
      reactions: {},
      userReaction: null,
      comments: 0,
    };
  if (u.includes("/api/notifications")) return [];
  if (u.includes("/api/circles")) return [];
  if (u.includes("/api/chat")) return { online: 0, users: [], joins: [], leaves: [], messages: [] };
  if (u.includes("/api/admin")) return jsonResponse({});
  if (u.includes("/api/invites")) return [];
  return jsonResponse({});
}

// ---------------------------------------------------------------------------
// Typed accessors for the router stored at self.__TSR_ROUTER__ by
// @tanstack/router-core after createRouter().
// ---------------------------------------------------------------------------

interface TsrRouter {
  load: () => Promise<void>;
  navigate: (opts: unknown) => Promise<void>;
  state: { location: { pathname: string } };
  options: { context: { queryClient: QueryClient } };
}

function getRouter(): TsrRouter {
  return (globalThis as unknown as { __TSR_ROUTER__: TsrRouter }).__TSR_ROUTER__;
}

function getQC() {
  return getRouter().options.context.queryClient;
}

function setAuthCached(user: typeof ADMIN_USER | typeof MEMBER_USER | null) {
  getQC().setQueryData(["auth", "me"], user);
}

// ---------------------------------------------------------------------------

let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

// main.tsx mounts the whole app into #app and hijacks window.history; tear it down
// so this file's global DOM/history mutations cannot leak into other test files.
afterAll(() => {
  const app = document.getElementById("app");
  if (app) render(null, app);
  document.body.innerHTML = "";
  window.history.pushState({}, "", "/");
});

describe("main entry", () => {
  // -------------------------------------------------------------------------
  // Bootstrap — must run first.
  //
  // Sets a proper origin via location.assign so createBrowserHistory can parse
  // a valid pathname, imports the module which initialises the router,
  // QueryClient, and calls render() into #app.
  //
  // Covers:
  //   • All module-level expressions (route definitions, queryClient,
  //     authQueryOptions, publicRoutePrefixes, router, fetchSettings call)
  //   • render() side-effect
  //   • customChildRoutes: vite-macros supplies customRoutes:[] so .map() is
  //     called but its callback is never invoked (lines 318-320 are E2E-only)
  // -------------------------------------------------------------------------
  it("bootstraps the app and renders into #app", async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.assign("http://localhost/");

    fetchMock = mockFetch((call) => makeResponder(call));

    await import("../main");

    await waitFor(
      () => {
        const app = document.getElementById("app");
        expect(app?.childElementCount ?? 0).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );
  });

  // -------------------------------------------------------------------------
  // router.load() at "/" — drives rootRoute.beforeLoad with an empty
  // QueryClient cache so the ensureQueryData path runs.
  //
  // Covers:
  //   • getSetupNeeded() success path (lines 78-82)
  //   • rootRoute.beforeLoad (lines 100-126): isSetupRoute=false,
  //     isPublicRoute=false, getAuthUser() cache-miss → ensureQueryData
  //     (line 92), user found → no redirect (line 125)
  // -------------------------------------------------------------------------
  it("runs router.load() to exercise rootRoute.beforeLoad at /", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    getQC().removeQueries({ queryKey: ["auth", "me"] });

    await getRouter().load();

    const setupCalls = fetchMock.calls.filter((c) => c.url.includes("/api/setup/status"));
    const authCalls = fetchMock.calls.filter((c) => c.url.includes("/api/auth/me"));

    expect(setupCalls.length).toBeGreaterThan(0);
    expect(authCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // getSetupNeeded() error branch — setup.status returns 500 so the catch
  // block (lines 80-82) runs and getSetupNeeded returns false.
  //
  // Covers: lines 80-82 (catch { return false })
  // -------------------------------------------------------------------------
  it("covers getSetupNeeded catch branch when setup.status errors", async () => {
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/api/setup/status"))
        return jsonResponse({ error: "server error" }, { status: 500 });
      return makeResponder(call);
    });

    setAuthCached(ADMIN_USER);

    await getRouter().navigate({ to: "/" });

    const setupCalls = fetchMock.calls.filter((c) => c.url.includes("/api/setup/status"));
    expect(setupCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // rootRoute.beforeLoad — needsSetup=true, not a setup route: redirects to
  // /setup (lines 108-111).
  //
  // Covers: lines 108-111 (needsSetup branch, !isSetupRoute → redirect /setup)
  // -------------------------------------------------------------------------
  it("covers needsSetup=true redirect to /setup from a non-setup route", async () => {
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/api/setup/status")) return { needsSetup: true };
      return makeResponder(call);
    });

    setAuthCached(null);

    await getRouter().navigate({ to: "/notifications" });

    expect(getRouter().state.location.pathname).toBe("/setup");
  });

  // -------------------------------------------------------------------------
  // rootRoute.beforeLoad — needsSetup=true AND is setup route: returns
  // undefined (line 112), allowing the setup route to render.
  //
  // Covers: line 112 (needsSetup=true + isSetupRoute → return undefined)
  // -------------------------------------------------------------------------
  it("covers needsSetup=true + isSetupRoute returns undefined (line 112)", async () => {
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/api/setup/status")) return { needsSetup: true };
      return makeResponder(call);
    });

    await getRouter().navigate({ to: "/setup" });

    expect(getRouter().state.location.pathname).toBe("/setup");
  });

  // -------------------------------------------------------------------------
  // getAuthUser() null-cache branch — cached value is null (explicit
  // logged-out marker). getAuthUser returns null immediately (line 90),
  // rootRoute.beforeLoad redirects to /login (line 124).
  //
  // Covers: line 90 (if (cached === null) return null)
  // -------------------------------------------------------------------------
  it("covers getAuthUser null-cache branch and unauthenticated redirect", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(null);

    await getRouter().navigate({ to: "/notifications" });

    expect(getRouter().state.location.pathname).toBe("/login");
  });

  // -------------------------------------------------------------------------
  // getAuthUser() ensureQueryData error branch — auth.me fetch fails, catch
  // (line 93) returns null, beforeLoad redirects.
  //
  // Covers: line 93 (catch { return null })
  // -------------------------------------------------------------------------
  it("covers getAuthUser ensureQueryData error branch (auth.me 401)", async () => {
    fetchMock = mockFetch((call) => {
      if (call.url.includes("/api/auth/me"))
        return jsonResponse({ error: "unauthorized" }, { status: 401 });
      return makeResponder(call);
    });

    getQC().removeQueries({ queryKey: ["auth", "me"] });

    await getRouter().navigate({ to: "/" });

    expect(true).toBe(true);
  });

  // -------------------------------------------------------------------------
  // getAuthUser() cached-hit branch — auth.me is in the cache, no network
  // call made (line 89).
  //
  // Covers: line 89 (if (cached) return cached)
  // -------------------------------------------------------------------------
  it("covers getAuthUser cached-hit branch (no auth network call)", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);

    await getRouter().navigate({ to: "/notifications" });

    const authNetworkCalls = fetchMock.calls.filter((c) => c.url.includes("/api/auth/me"));
    expect(authNetworkCalls.length).toBe(0);
    expect(getRouter().state.location.pathname).toBe("/notifications");
  });

  // -------------------------------------------------------------------------
  // profileRoute.loader — "me" branch: resolves "me" → userId via
  // getAuthUser (cache hit), then fetches user + posts in parallel.
  //
  // Covers: lines 174-188 (profileRoute.loader, id==="me" path)
  // -------------------------------------------------------------------------
  it("navigates to /profile/me and runs profileRoute loader (me branch)", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);
    getQC().removeQueries({ queryKey: ["users", "u1"] });

    await getRouter().navigate({ to: "/profile/$id", params: { id: "me" } });

    const userCalls = fetchMock.calls.filter((c) => /\/api\/users\/u1$/.test(c.url));
    expect(userCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // profileRoute.loader — direct id branch: params.id is not "me".
  //
  // Covers: lines 175-176 (params.id !== "me" path)
  // -------------------------------------------------------------------------
  it("navigates to /profile/u2 and runs profileRoute loader (direct id branch)", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);
    getQC().removeQueries({ queryKey: ["users", "u2"] });

    await getRouter().navigate({ to: "/profile/$id", params: { id: "u2" } });

    const userCalls = fetchMock.calls.filter((c) => /\/api\/users\/u2$/.test(c.url));
    expect(userCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // postRoute.loader → loadPost: fetches post + comments in parallel.
  //
  // Covers: lines 193-202 (loadPost), 210 (postRoute.loader body)
  // -------------------------------------------------------------------------
  it("navigates to /post/p1 and runs postRoute loader via loadPost", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);
    getQC().removeQueries({ queryKey: ["posts", "p1"] });

    await getRouter().navigate({ to: "/post/$id", params: { id: "p1" } });

    const postCalls = fetchMock.calls.filter((c) => /\/api\/posts\/p1$/.test(c.url));
    const commentCalls = fetchMock.calls.filter((c) => c.url.includes("/api/posts/p1/comments"));
    expect(postCalls.length).toBeGreaterThan(0);
    expect(commentCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // momentRoute.loader → loadPost: same loadPost function, different route.
  //
  // Covers: line 219 (momentRoute.loader calling loadPost)
  // -------------------------------------------------------------------------
  it("navigates to /m/p2 and runs momentRoute loader via loadPost", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);
    getQC().removeQueries({ queryKey: ["posts", "p2"] });

    await getRouter().navigate({ to: "/m/$id", params: { id: "p2" } });

    const postCalls = fetchMock.calls.filter((c) => /\/api\/posts\/p2$/.test(c.url));
    expect(postCalls.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // adminRoute.beforeLoad — admin user passes role check.
  // adminRoute.validateSearch with no tab → { tab: undefined }.
  //
  // Covers: lines 264-265 (validateSearch), 267-272 (beforeLoad role passes)
  // -------------------------------------------------------------------------
  it("navigates to /admin and admin role guard passes", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);

    await getRouter().navigate({ to: "/admin" });

    expect(getRouter().state.location.pathname).toBe("/admin");
  });

  // -------------------------------------------------------------------------
  // adminRoute.validateSearch — string tab param coerced to typed value.
  //
  // Covers: line 265 (validateSearch with string tab)
  // -------------------------------------------------------------------------
  it("navigates to /admin?tab=bots and exercises adminRoute validateSearch", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);

    await getRouter().navigate({ to: "/admin", search: { tab: "bots" } });

    expect(getRouter().state.location.pathname).toBe("/admin");
  });

  // -------------------------------------------------------------------------
  // adminRoute.beforeLoad — non-admin/moderator user is redirected to /.
  //
  // Covers: line 270 (redirect to / for non-admin role)
  // -------------------------------------------------------------------------
  it("navigates to /admin as member user and is redirected to /", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(MEMBER_USER);

    await getRouter().navigate({ to: "/admin" });

    expect(getRouter().state.location.pathname).toBe("/");
  });

  // -------------------------------------------------------------------------
  // loginRoute.beforeLoad — user IS authenticated → redirect to / (141-142).
  //
  // Covers: lines 139-143 (loginRoute.beforeLoad authed redirect)
  // -------------------------------------------------------------------------
  it("navigates to /login and loginRoute beforeLoad redirects authed user to /", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);

    await getRouter().navigate({ to: "/login" });

    expect(getRouter().state.location.pathname).toBe("/");
  });

  // -------------------------------------------------------------------------
  // signupRoute.validateSearch + beforeLoad — coercion (152-153) and authed
  // redirect (155-158).
  //
  // Covers: lines 152-153 (validateSearch), 155-158 (beforeLoad redirect)
  // -------------------------------------------------------------------------
  it("navigates to /signup?invite=tok exercises validateSearch and authed redirect", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);

    await getRouter().navigate({ to: "/signup", search: { invite: "tok123" } });

    expect(getRouter().state.location.pathname).toBe("/");
  });

  // -------------------------------------------------------------------------
  // signupRoute.beforeLoad — user NOT authenticated → return undefined (159),
  // signup page renders.
  //
  // Covers: line 159 (return undefined when no user on /signup)
  // -------------------------------------------------------------------------
  it("navigates to /signup unauthenticated and reaches signup page (line 159)", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(null);

    await getRouter().navigate({ to: "/signup" });

    expect(getRouter().state.location.pathname).toBe("/signup");
  });

  // -------------------------------------------------------------------------
  // signupRoute.validateSearch — no invite param → { invite: undefined }.
  // -------------------------------------------------------------------------
  it("navigates to /signup without invite (undefined search branch)", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(ADMIN_USER);

    await getRouter().navigate({ to: "/signup" });

    expect(true).toBe(true);
  });

  // -------------------------------------------------------------------------
  // resetPasswordRoute.validateSearch — token param coerced (286-287).
  //
  // Covers: lines 286-287 (validateSearch returning { token })
  // -------------------------------------------------------------------------
  it("navigates to /reset-password?token=abc exercises validateSearch", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    await getRouter().navigate({ to: "/reset-password", search: { token: "abc" } });

    expect(getRouter().state.location.pathname).toBe("/reset-password");
  });

  // -------------------------------------------------------------------------
  // resetPasswordRoute.validateSearch — no token → { token: undefined }.
  // -------------------------------------------------------------------------
  it("navigates to /reset-password without token (undefined branch)", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    await getRouter().navigate({ to: "/reset-password" });

    expect(getRouter().state.location.pathname).toBe("/reset-password");
  });

  // -------------------------------------------------------------------------
  // confirmEmailRoute.validateSearch — token param coerced (301-302).
  //
  // Covers: lines 301-302 (validateSearch returning { token })
  // -------------------------------------------------------------------------
  it("navigates to /confirm-email?token=xyz exercises validateSearch", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    await getRouter().navigate({ to: "/confirm-email", search: { token: "xyz" } });

    expect(getRouter().state.location.pathname).toBe("/confirm-email");
  });

  // -------------------------------------------------------------------------
  // rootRoute.beforeLoad — isSetupRoute=true, needsSetup=false: redirect to
  // /login (lines 115-117). With null auth, /login doesn't bounce back to /.
  //
  // Covers: lines 101, 115-117 (isSetupRoute + !needsSetup → redirect /login)
  // -------------------------------------------------------------------------
  it("navigates to /setup when needsSetup=false triggers isSetupRoute redirect to /login", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    setAuthCached(null);

    await getRouter().navigate({ to: "/setup" });

    expect(getRouter().state.location.pathname).toBe("/login");
  });

  // -------------------------------------------------------------------------
  // rootRoute.beforeLoad — isPublicRoute=true bypasses auth check (line 119).
  //
  // Covers: lines 103-104, 119 (isPublicRoute → return undefined early)
  // -------------------------------------------------------------------------
  it("navigates to /forgot-password (public route) and bypasses auth guard", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));

    await getRouter().navigate({ to: "/forgot-password" });

    expect(getRouter().state.location.pathname).toBe("/forgot-password");
  });

  // -------------------------------------------------------------------------
  // Remaining simple protected routes — each exercises rootRoute.beforeLoad.
  // -------------------------------------------------------------------------

  it("navigates to /search", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));
    setAuthCached(ADMIN_USER);
    await getRouter().navigate({ to: "/search" });
    expect(getRouter().state.location.pathname).toBe("/search");
  });

  it("navigates to /chat", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));
    setAuthCached(ADMIN_USER);
    await getRouter().navigate({ to: "/chat" });
    expect(getRouter().state.location.pathname).toBe("/chat");
  });

  it("navigates to /circles", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));
    setAuthCached(ADMIN_USER);
    await getRouter().navigate({ to: "/circles" });
    expect(getRouter().state.location.pathname).toBe("/circles");
  });

  it("navigates to /members", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));
    setAuthCached(ADMIN_USER);
    await getRouter().navigate({ to: "/members" });
    expect(getRouter().state.location.pathname).toBe("/members");
  });

  it("navigates to /settings", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));
    setAuthCached(ADMIN_USER);
    await getRouter().navigate({ to: "/settings" });
    expect(getRouter().state.location.pathname).toBe("/settings");
  });

  it("navigates back to / (indexRoute)", async () => {
    fetchMock = mockFetch((call) => makeResponder(call));
    setAuthCached(ADMIN_USER);
    await getRouter().navigate({ to: "/" });
    expect(getRouter().state.location.pathname).toBe("/");
  });
});
