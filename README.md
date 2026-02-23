# Knitly

> A private social network for small, trusted circles.
> Self-hosted. Invite-only. No algorithms. No strangers.

Knitly is a lightweight social app designed for families and small communities who want to share life without surveillance, ads, or public feeds.

Think early social media — before it became a performance platform.
Chronological timeline. Simple profiles. Moments with friends.

No growth hacks. No infinite scroll psychology.
Just your people.

---

## Philosophy

Modern social media optimized for scale, not humans. Knitly scales back to human size.

Each instance is a closed network for ~120 people — roughly the size of a real-world social circle. If you're not invited, it doesn't exist.

**Knitly is:**
- a private timeline for friends & family
- a shared memory space
- a calm alternative to algorithmic feeds
- infrastructure for trusted communities

**Knitly is not:**
- a public social network
- an influencer platform
- an ad network
- a discovery feed
- a dopamine machine

Friction is a feature. The goal is intimacy, not scale.

---

## Features

### Moments
- Text posts with photos (up to 6 images) or video (30s max, 720p)
- Chronological feed (no algorithm)
- Reactions (love, haha, hugs, celebrate)
- Comments with markdown support
- Edit/delete your own content
- Image lightbox with gallery navigation
- @mentions

### Profiles
- Bio, avatar, header/cover image
- Location and website links
- Posts and media tabs

### Circles
- Create private groups within your network
- Share posts with specific circles only
- Manage circle membership

### The Lobby
- Ephemeral group chat room (IRC/AOL vibes)
- Messages disappear after 24 hours
- See who's online, join/leave announcements
- No chat history anxiety — conversations are fleeting

### Polls
- Create polls on any post
- Multiple choice with customizable options

### Network
- Invite-only membership
- Closed member directory
- No public access or guest viewing

### Notifications
- Reactions and comments on your moments
- In-app only (no email spam)

### Admin
- Generate and revoke invite links
- User management (disable, promote, remove)
- Content moderation (delete posts/comments)
- Audit log for accountability
- Customize app name and logo
- Backup and restore database

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Bun + Hono |
| Database | SQLite |
| Frontend | Preact + TanStack Query/Router |
| Styling | Tailwind v4 |
| Storage | S3-compatible (or local filesystem) |
| Auth | Session cookies (Argon2 hashing) |

Intentionally simple to deploy and maintain.

---

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/knitly-app/knitly.git
cd knitly
docker compose up -d
```

Open http://localhost:3000 — the first user to sign up becomes admin.

To customize, copy `docker-compose.yml` and set your environment variables:

```yaml
environment:
  - BASE_URL=https://your-domain.com
  - ALLOWED_ORIGINS=https://your-domain.com
```

### Local Development

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
bun --cwd server run seed      # creates one admin user
bun --cwd server run seed:dev  # with test data (20 users)
```

Override admin credentials:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpass bun --cwd server run seed
```

---

## Configuration

Defaults work out of the box. Override with environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | API server port |
| `BASE_URL` | `http://localhost:3000` | Public URL |
| `DATABASE_PATH` | `../knitly.db` | SQLite location |
| `USE_LOCAL_STORAGE` | `true` | Store uploads on local filesystem |
| `LOCAL_UPLOAD_DIR` | `../uploads` | Local media directory |
| `ALLOWED_ORIGINS` | — | CORS whitelist (comma-separated) |

### S3-Compatible Storage (optional)

For cloud storage instead of local filesystem:

| Variable | Purpose |
|----------|---------|
| `SPACES_ENDPOINT` | S3 endpoint URL |
| `SPACES_REGION` | S3 region |
| `SPACES_BUCKET` | Bucket name |
| `SPACES_KEY` | Access key |
| `SPACES_SECRET` | Secret key |
| `SPACES_PUBLIC_URL` | CDN URL for uploads |

See [`.env.sample`](.env.sample) and [`deploy/env.production.example`](deploy/env.production.example) for full reference.

---

## Deployment

Knitly runs comfortably on a $6/mo VPS, a Raspberry Pi, or any Linux box.

### Docker

```bash
docker compose up -d
```

Data persists in a Docker volume. Put a reverse proxy (Caddy, nginx) in front for HTTPS. See [`deploy/Caddyfile.example`](deploy/Caddyfile.example).

### Bare Metal

1. Install [Bun](https://bun.sh) and ffmpeg
2. Clone the repo and `bun install`
3. Build the frontend: `bun run build`
4. Copy `deploy/env.production.example` to `server/.env.production` and fill in values
5. Start: `bun run start`
6. Set up a process manager:
   - **systemd:** copy [`deploy/knitly.service`](deploy/knitly.service) to `/etc/systemd/system/`
   - **OpenRC:** copy [`deploy/knitly.openrc`](deploy/knitly.openrc) to `/etc/init.d/knitly`
7. Put Caddy or nginx in front for HTTPS

### First Run

On first visit, Knitly shows a setup screen where you create the admin account. After that, the instance is invite-only — the admin generates invite links for new members.

---

## Data Ownership

You own your instance. You own your media. You own your memories.

- Exportable backups from admin panel
- Portable SQLite database
- Media stored on your filesystem or your S3 bucket

You are never locked in.

---

## Tests

```bash
bun test                          # all tests
bun --cwd server test             # server API tests
bun --cwd frontend run test       # frontend unit tests
bun --cwd frontend run test:e2e   # playwright e2e
```

---

## Roadmap

- Shared albums
- Link previews
- Push notifications (optional)
- Import/export tools

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.

If you believe social software should feel human again, you're in the right place.

---

## License

[MIT](LICENSE)

---

Knitly is a digital living room.

A place for the people you trust.
A network that belongs to you.
A timeline that moves at the speed of real life.

Welcome home.
