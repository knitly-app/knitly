# Knitly TODO

## Project Status: MVP Complete

Core social features working: posts, comments, reactions, circles, notifications, search, admin panel with customization. Ready for UX polish and feature expansion.

---

## UX Polish

- [x] **Image lightbox** — Click to view images larger, swipe through galleries
- [ ] **Loading skeletons** — Replace spinners with content placeholders
- [ ] Invite validation bug (shows wrong inviter)

## Feature Expansion

### Media
- [ ] **Video uploads** — Extend presigned upload flow to support video formats
- [ ] **Profile header image** — Custom banner/cover photo for profiles
- [ ] **Shared albums** — Collaborative photo collections

### Profile
- [x] **Header/cover image upload** — Replace gradient with custom image
- [ ] **Profile theme colors** — Let users pick accent color

### Content
- [ ] **@ mentions** — Tag users in posts/comments
- [ ] **Link previews** — Unfurl URLs with Open Graph data

### Account
- [ ] **Password reset** — Email-based recovery flow
- [ ] **Account deletion** — Self-service with confirmation

---

## Admin/Infrastructure

- [ ] Disk usage / storage overview
- [ ] Database backup/restore
- [ ] Exportable archive (zip download)

---

## Future Ideas (Not Planned)

- Direct messaging
- Dark mode
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
