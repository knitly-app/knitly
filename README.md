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
| Auth | Session cookies |

Intentionally simple to deploy and maintain.

---

## Quick Start

**Requirements:** Bun, ffmpeg (for video processing)

```bash
git clone https://github.com/yourname/knitly
cd knitly
bun install
bun run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3000

### Seed Data

```bash
bun --cwd server run seed      # production seed
bun --cwd server run seed:dev  # with test data
```

Default admin: `mike@mk3y.com` / `password123`

---

## Configuration

### Local Development

Defaults work out of the box. Override if needed:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_PATH` | `../circles.db` | SQLite location |
| `PORT` | `3000` | API server port |
| `USE_LOCAL_STORAGE` | `true` | Store uploads locally |
| `LOCAL_UPLOAD_DIR` | `../uploads` | Local media directory |
| `BASE_URL` | `http://localhost:3000` | Public URL for media |

### Production (S3/Spaces)

Required: `SPACES_ENDPOINT`, `SPACES_REGION`, `SPACES_BUCKET`, `SPACES_KEY`, `SPACES_SECRET`

Optional: `SPACES_PUBLIC_URL`, `MAX_UPLOAD_BYTES`, `MEDIA_MAX_DIMENSION`, `MEDIA_QUALITY`

---

## Deployment

Runs comfortably on:
- a small VPS
- a home server
- a Raspberry Pi
- Docker
- any Linux box

Recommended:
- SQLite backups enabled
- Object storage for photos
- HTTPS via reverse proxy

Full deployment guide: [docs/deploy.md](docs/deploy.md)

---

## Data Ownership

You own your instance. You own your media. You own your memories.

- Exportable backups
- Portable database
- Media archive access

You are never locked in.

---

## Tests

```bash
bun test server/tests         # API tests
bun --cwd frontend run test   # Frontend tests
```

---

## Roadmap

- Shared albums
- @ mentions
- Link previews
- Password reset flow
- Dark mode

---

## Docs

- [Design Doc](docs/plans/2026-02-01-knitly-design.md)
- [Testing Strategy](docs/testing.md)

---

## Contributing

Pull requests welcome.

If you believe social software should feel human again, you're in the right place.

---

## License

MIT

---

Knitly is a digital living room.

A place for the people you trust.
A network that belongs to you.
A timeline that moves at the speed of real life.

Welcome home.
