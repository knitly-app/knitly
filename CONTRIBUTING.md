# Contributing to Knitly

Thanks for your interest in Knitly. Here's what you need to know.

## Development Setup

**Requirements:** [Bun](https://bun.sh), ffmpeg (optional, for video processing)

```bash
git clone https://github.com/knitly-app/knitly.git
cd knitly
bun install
bun run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3000

### Seed Data

```bash
bun --cwd server run seed        # creates one admin user
bun --cwd server run seed:dev    # creates admin + test data
```

Override admin credentials with env vars:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpass bun --cwd server run seed
```

## Project Structure

```
frontend/     Preact SPA (TanStack Query/Router, Tailwind v4)
server/       Hono API (Bun, SQLite, session auth)
custom/       Gitignored per-deployment extensions
deploy/       Example configs (Caddy, systemd, env)
```

## Code Style

- **Preact** with hooks, not class components
- **TanStack Query** for all server state — never duplicate in useState/Zustand
- **Derive state** as expressions — avoid unnecessary useState
- **No useCallback** — ever
- **No useEffect** unless syncing with external systems
- **No barrel files** (index.ts re-exports)
- **No comments** unless the logic is genuinely non-obvious
- Self-documenting names over explanatory comments

Run linting before submitting:

```bash
bun run lint
bun run lint:fix
```

## Making Changes

1. Fork the repo and create a branch (`feature/your-thing` or `bugfix/your-thing`)
2. Make your changes
3. Run tests: `bun test`
4. Run lint: `bun run lint`
5. Open a pull request against `main`

### PR Guidelines

- Keep PRs focused — one feature or fix per PR
- Write a clear description of what changed and why
- If it touches UI, include a screenshot
- Don't refactor unrelated code in the same PR

## Tests

```bash
bun test                          # all tests
bun --cwd server test             # server tests
bun --cwd frontend run test       # frontend tests
bun --cwd frontend run test:e2e   # playwright e2e
```

## Architecture Decisions

Knitly is intentionally simple. Before adding complexity, ask:

- Can this be solved without a new dependency?
- Does this follow existing patterns in the codebase?
- Is the complexity justified for ~120 users per instance?
- Would a new contributor understand this without explanation?

## Reporting Bugs

Use [GitHub Issues](https://github.com/knitly-app/knitly/issues) with the bug report template.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
