# Server Testing Pyramid

WHY
- fast feedback, unit > integration > e2e
- reduce flake, keep DB + HTTP minimal
- focus P0/P1, cover core flows first

HOW
- tests live in `server/tests/p0-p1.test.js`
- integration uses `createApp()`; no real server
- temp sqlite via `DATABASE_PATH=/tmp/circles-test-<id>.db`
- reset DB per test; seed via `dbUtils`
- cookies set with `COOKIE_NAME`

RUN
- `bun test server/tests`

ADD TESTS
- prefer unit in same file, new `describe` block
- add integration via `jsonReq` helper
- keep pyramid shape: many unit, fewer integration, minimal e2e

NOTES
- sqlite + bun cache can clash across test files; single file avoids closed DB errors
- signup needs invite token unless DB empty; tests seed invite if needed
