# Knitly TODO

## Project Status: MVP Complete

Core social features working: posts, comments, reactions, circles, notifications, search, admin panel with customization. Ready for UX polish and feature expansion.

---

## Critical Issues

- [ ] **🔴 Git security cleanup** — Console.logs exposing personal info, log folders not in .gitignore (may require repo reset)

## Bugs

- [ ] **Image auto-save** — Header/profile images should save on upload without requiring Save button
- [ ] **Image cleanup** — Old images not deleted on replace (5 images on server, should be 2)
- [ ] **Heart icon styling** — Should be black/white like other icons until someone actually reacts
- [ ] **Mobile scroll bug** — Can scroll up and navigation leaves bottom of page
- [ ] **Lobby mobile CSS** — Doesn't fit properly, scaling issues on mobile
- [ ] **Localhost DB reset** — Dev mode showing initial setup when DB already exists
- [ ] **Admin profile access** — Need better mobile navigation to admin profile

## UX Polish

- [x] **Image lightbox** — Click to view images larger, swipe through galleries
- [x] ~~Loading skeletons~~ — Replace spinners with content placeholders
- [x] ~~Invite validation bug~~ — removed inviter line entirely

## Feature Expansion

### Media
- [x] **Video uploads** — 30s max, 720p, ffmpeg transcoding, CreatePostModal redesign
- [x] ~~Profile header image~~ — Custom banner/cover photo for profiles
- [ ] **Shared albums** — Collaborative photo collections

### Profile
- [x] **Header/cover image upload** — Replace gradient with custom image
- [ ] **Profile theme colors** — Let users pick accent color

### Content
- [ ] **@ mentions** — Tag users in posts/comments
- [ ] **Link previews** — Unfurl URLs with Open Graph data
- [ ] **Polls** — Simple voting on posts (moved from Phase 2)

### Account
- [ ] **Password reset** — Email-based recovery flow
- [ ] **Account deletion** — Self-service with confirmation

### Progressive Web App
- [ ] **iOS PWA support** — Make app installable on iOS devices
- [ ] **Offline mode** — Basic caching for offline viewing

### Theming
- [ ] **Dark mode** — System preference + manual toggle

---

## Admin/Infrastructure

- [x] ~~First-time setup wizard~~ — Detect empty db, show "Create Admin" form on first visit
- [ ] Disk usage / storage overview
- [ ] Database backup/restore
- [ ] Exportable archive (zip download)

---

## Phase 2 — Community Features

- [ ] **AMA / Ask box** — Direct questions to users (anonymous optional)
- [ ] **Shared calendar** — Birthdays + events with RSVP

---

## Future Ideas (Not Planned)

- Direct messaging
- Kid-safe mode
- Hashtags/trending
- Post bookmarks

---

## Completed

### Core Features
- [x] Feed with infinite scroll
- [x] Post creation with multi-image support (up to 6)
- [x] Post editing and deletion
- [x] Reactions (love, haha, hugs, celebrate)
- [x] Comments with threading
- [x] Notifications (reactions, comments, follows)
- [x] User profiles with avatar upload
- [x] Profile editing (bio, location, website)
- [x] Circles for audience control
- [x] Circle-filtered posting
- [x] Search (users + posts)
- [x] Member directory
- [x] The Lobby — ephemeral group chat (IRC/AOL vibes, polling-based, 24h TTL)

### Admin Panel
- [x] Stats overview
- [x] User management (disable, promote, demote, remove)
- [x] Invite management (create, revoke)
- [x] Content moderation (delete posts/comments)
- [x] Audit log
- [x] Ownership transfer
- [x] Session revocation
- [x] Customize tab (app name + logo icon)

### Polish
- [x] Share link functionality
- [x] Avatar upload with compression
- [x] Error boundary with friendly UI
- [x] Back buttons use browser history
- [x] Feed shows all posts (no follow filter)
- [x] Removed followers/following from UI
- [x] Removed member invite UI
- [x] Markdown support for posts/comments (`**bold**`, `*italic*`)

### Security & Performance (120 Users Optimization)
- [x] Rate limiting (auth: 5/min, search: 20/min, API: 100/min)
- [x] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] XSS sanitization on posts, comments, search
- [x] File upload hardening (magic byte validation, dimension limits)
- [x] Session cleanup script
- [x] N+1 query fixes (feed, user posts, search)
- [x] Database indexes for common queries
- [x] Frontend bundle optimization (lazy routes, vendor splitting)
- [x] Image lazy loading (16 images)
- [x] TanStack Query caching (staleTime/gcTime)
- [x] Error boundaries with graceful fallbacks
- [x] Unit tests for new security/perf code
