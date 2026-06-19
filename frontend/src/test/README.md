# Frontend tests

Runner: `bun test`. DOM: `happy-dom` (registered in `register-dom.ts`). Rendering:
`@testing-library/preact`. Matchers: `@testing-library/jest-dom` (typed via `jest-dom.d.ts`).

`react`/`react-dom` resolve to `preact/compat` through `scripts/setup-react-shim.js`
(a postinstall step). Don't import `react` directly in tests — import from `preact`,
`@testing-library/preact`, or the app's own modules.

## Layout

- `src/test/unit/*.test.ts` — pure functions, stores, hooks, api endpoints
- `src/test/component/*.test.tsx` — rendered components
- `src/test/helpers/` — shared `mockFetch` and `renderWithProviders`
- `src/entry-test/main.test.tsx` — covers the `main.tsx` entry. Runs in a **separate
  bun process** (`bun test src/entry-test`) because importing `main.tsx` mounts the whole
  app and `@preact/signals` patches preact's global `options`, which corrupts the hooks
  runtime for any other test file sharing the process. `bun run test` runs both suites.

## Helpers

### `mockFetch(responderOrValue)` — `helpers/fetch.ts`

Replaces `globalThis.fetch`. Pass a static value (returned as JSON) or a function
`(call) => value | Response`. Returns `{ calls, lastCall(), restore() }`. Always
`restore()` in `afterEach`. Use `jsonResponse(body, init)` / `errorResponse(status, body)`
to shape responses.

```ts
let fetchMock: MockFetchResult;
afterEach(() => fetchMock?.restore());

fetchMock = mockFetch({ id: "1" });
await users.get("1");
expect(fetchMock.lastCall()).toMatchObject({ url: "/api/users/1", method: "GET" });
```

### `renderWithProviders(ui, options?)` — `helpers/render.tsx`

Async. Wraps `ui` in `QueryClientProvider` + `ToastProvider` + `ConfirmProvider` +
a memory-history TanStack Router (so `<Link>`/`useNavigate` work). **Always `await` it.**
Returns the testing-library result plus `queryClient`. `rerender` drops the providers —
render fresh instead of rerendering.

```tsx
fetchMock = mockFetch({});
await renderWithProviders(<ProfileCard user={user} />);
expect(screen.getByText("Ada")).toBeInTheDocument();
```

Options: `{ queryClient, path, initialEntries, withProviders: false }`.

### `renderHookWithClient(callback, queryClient?)` — `helpers/render.tsx`

For hooks needing `QueryClientProvider`. Mutations are async — `await waitFor(...)`.

```ts
const { result } = renderHookWithClient(() => useFollow("u1"));
result.current.follow();
await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(0));
```

## Rules

- Test observable behavior through the public interface, not implementation details.
- Reset zustand stores in `beforeEach` with `store.setState(...)`.
- Before finishing: `bun test <file>` passes, `bunx eslint <file>` clean, prettier formatted.
