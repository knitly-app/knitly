import { Database } from "bun:sqlite";
import crypto from "crypto";
import { hashPassword } from "./lib/security.js";
import { logInfo, logError } from "./lib/logging.js";

const dbPath = process.env.DATABASE_PATH || "../knitly.dev.db";
const db = new Database(dbPath);

db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT,
    bio TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, following_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    email TEXT,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used INTEGER NOT NULL DEFAULT 0,
    used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
`);

const USERS = [
  { email: "mike@mk3y.com", username: "mike", displayName: "Mike", role: "admin", bio: "Building things. Breaking things. Fixing things." },
  { email: "sarah@example.com", username: "sarah", displayName: "Sarah Chen", role: "member", bio: "Designer by day, reader by night." },
  { email: "alex@example.com", username: "alex", displayName: "Alex Rivera", role: "member", bio: "Coffee enthusiast. Code wrangler." },
  { email: "jamie@example.com", username: "jamie", displayName: "Jamie Park", role: "member", bio: "Photography | Travel | Good vibes" },
  { email: "taylor@example.com", username: "taylor", displayName: "Taylor Kim", role: "member", bio: "Product person. Opinions are my own." },
  { email: "jordan@example.com", username: "jordan", displayName: "Jordan Lee", role: "member", bio: "Full-stack dev. Part-time chef." },
  { email: "casey@example.com", username: "casey", displayName: "Casey Morgan", role: "member", bio: "Marketing @ startup. Dog parent." },
  { email: "riley@example.com", username: "riley", displayName: "Riley Johnson", role: "member", bio: "Music producer. Night owl." },
  { email: "quinn@example.com", username: "quinn", displayName: "Quinn Thompson", role: "member", bio: "Fitness junkie. Plant-based life." },
];

const POSTS = [
  { userIdx: 0, content: "Just shipped a new feature! The invite system is finally working. Can't wait to see this community grow.", mediaUrl: null },
  { userIdx: 1, content: "Working on some new UI concepts today. There's something magical about that moment when the design just clicks.", mediaUrl: "https://picsum.photos/seed/design1/800/600" },
  { userIdx: 2, content: "Third cup of coffee and finally figured out that bug that's been haunting me for two days. Sometimes you just need to step away and come back fresh.", mediaUrl: null },
  { userIdx: 3, content: "Golden hour at the beach. Sometimes the best moments are the unplanned ones.", mediaUrl: "https://picsum.photos/seed/beach1/800/600" },
  { userIdx: 4, content: "Hot take: the best product decisions come from talking to users, not from endless strategy meetings.", mediaUrl: null },
  { userIdx: 5, content: "Made homemade pasta for the first time. Definitely not as hard as I thought! Here's the result.", mediaUrl: "https://picsum.photos/seed/pasta1/800/600" },
  { userIdx: 6, content: "Our team just hit a major milestone. Grateful to work with such talented people.", mediaUrl: null },
  { userIdx: 7, content: "New track dropping next week. Been working on this one for months. The wait is almost over.", mediaUrl: "https://picsum.photos/seed/music1/800/600" },
  { userIdx: 8, content: "5am workout complete. There's something about starting the day with movement that just sets the right tone.", mediaUrl: null },
  { userIdx: 0, content: "Reading 'The Pragmatic Programmer' again. Every time I pick it up I learn something new.", mediaUrl: null },
  { userIdx: 1, content: "Finished that book everyone's been talking about. No spoilers but wow, that ending.", mediaUrl: null },
  { userIdx: 2, content: "Who else thinks we need more keyboard shortcuts in modern apps? I want to keep my hands on the keyboard.", mediaUrl: null },
  { userIdx: 3, content: "Sunrise hike this morning. Worth every minute of lost sleep.", mediaUrl: "https://picsum.photos/seed/hike1/800/600" },
  { userIdx: 4, content: "Simplicity is the ultimate sophistication. Spent the day removing features, not adding them.", mediaUrl: null },
  { userIdx: 5, content: "When the code compiles on the first try... suspicious.", mediaUrl: null },
  { userIdx: 6, content: "Pro tip: your dog doesn't care about your quarterly goals. They just want belly rubs.", mediaUrl: "https://picsum.photos/seed/dog1/800/600" },
  { userIdx: 7, content: "Late night studio session. The creative energy hits different at 2am.", mediaUrl: null },
  { userIdx: 8, content: "Rest days are just as important as training days. Taking my own advice today.", mediaUrl: null },
];

const COMMENTS = [
  { postIdx: 0, userIdx: 1, content: "Congrats! Can't wait to try it out." },
  { postIdx: 0, userIdx: 2, content: "Been waiting for this. Ship it!" },
  { postIdx: 1, userIdx: 0, content: "Love the color palette. Very clean." },
  { postIdx: 1, userIdx: 4, content: "This is gorgeous. What tools are you using?" },
  { postIdx: 2, userIdx: 5, content: "Been there. The relief when you finally crack it is unmatched." },
  { postIdx: 3, userIdx: 6, content: "Beautiful shot! Where is this?" },
  { postIdx: 3, userIdx: 7, content: "Need to get out there more. Thanks for the reminder." },
  { postIdx: 5, userIdx: 8, content: "That looks amazing! Recipe please?" },
  { postIdx: 5, userIdx: 0, content: "Way better than my first attempt haha" },
  { postIdx: 7, userIdx: 3, content: "Can't wait to hear it!" },
  { postIdx: 8, userIdx: 4, content: "The discipline! I can barely get up at 7." },
  { postIdx: 12, userIdx: 1, content: "That view though. Worth it." },
  { postIdx: 15, userIdx: 2, content: "Your dog is adorable!" },
  { postIdx: 16, userIdx: 0, content: "Those late sessions hit different. Don't burn out though!" },
];

function randomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function shuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randomInt(8, 22), randomInt(0, 59), randomInt(0, 59));
  return d.toISOString().replace("T", " ").split(".")[0];
}

async function seed() {
  logInfo(`Seeding database at: ${dbPath}`);
  logInfo("");

  const existingCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (existingCount > 0) {
    logInfo(`Database already has ${existingCount} users. Clearing all data first...`);
    db.exec("DELETE FROM notifications");
    db.exec("DELETE FROM comments");
    db.exec("DELETE FROM likes");
    db.exec("DELETE FROM follows");
    db.exec("DELETE FROM posts");
    db.exec("DELETE FROM invites");
    db.exec("DELETE FROM sessions");
    db.exec("DELETE FROM users");
    logInfo("Cleared existing data.");
    logInfo("");
  }

  const passwordHash = await hashPassword("password123");
  const userIds = [];

  logInfo("Creating users...");
  for (const u of USERS) {
    const result = db.prepare(`
      INSERT INTO users (email, username, display_name, password_hash, bio, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(u.email, u.username, u.displayName, passwordHash, u.bio, u.role, pastDate(randomInt(30, 60)));
    userIds.push(Number(result.lastInsertRowid));
  }
  logInfo(`  Created ${userIds.length} users`);
  logInfo("");

  logInfo("Creating full mesh follows...");
  let followCount = 0;
  for (const followerId of userIds) {
    for (const followingId of userIds) {
      if (followerId !== followingId) {
        db.prepare(`INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)`)
          .run(followerId, followingId, pastDate(randomInt(20, 40)));
        followCount++;
      }
    }
  }
  logInfo(`  Created ${followCount} follow relationships`);
  logInfo("");

  logInfo("Creating posts...");
  const postIds = [];
  for (let i = 0; i < POSTS.length; i++) {
    const p = POSTS[i];
    const userId = userIds[p.userIdx];
    const result = db.prepare(`
      INSERT INTO posts (user_id, content, media_url, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, p.content, p.mediaUrl, pastDate(POSTS.length - i));
    postIds.push(Number(result.lastInsertRowid));
  }
  logInfo(`  Created ${postIds.length} posts`);
  logInfo("");

  logInfo("Creating likes...");
  let likeCount = 0;
  for (const postId of postIds) {
    const numLikes = randomInt(2, 7);
    const likers = shuffle(userIds).slice(0, numLikes);
    for (const userId of likers) {
      db.prepare(`INSERT OR IGNORE INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)`)
        .run(userId, postId, pastDate(randomInt(0, 10)));
      likeCount++;
    }
  }
  logInfo(`  Created ${likeCount} likes`);
  logInfo("");

  logInfo("Creating comments...");
  const commentIds = [];
  for (const c of COMMENTS) {
    const postId = postIds[c.postIdx];
    const userId = userIds[c.userIdx];
    const result = db.prepare(`
      INSERT INTO comments (post_id, user_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(postId, userId, c.content, pastDate(randomInt(0, 8)));
    commentIds.push({ id: Number(result.lastInsertRowid), postIdx: c.postIdx, userIdx: c.userIdx });
  }
  logInfo(`  Created ${commentIds.length} comments`);
  logInfo("");

  logInfo("Creating notifications...");
  let notifCount = 0;

  for (const postIdx of [0, 1, 3, 5, 7, 12, 15, 16]) {
    const postId = postIds[postIdx];
    const postOwnerIdx = POSTS[postIdx].userIdx;
    const postOwnerId = userIds[postOwnerIdx];

    const likerIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => i !== postOwnerIdx).slice(0, randomInt(2, 4));
    for (const likerIdx of likerIndices) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, actor_id, post_id, read, created_at)
        VALUES (?, 'like', ?, ?, ?, ?)
      `).run(postOwnerId, userIds[likerIdx], postId, randomInt(0, 1), pastDate(randomInt(0, 5)));
      notifCount++;
    }
  }

  for (const c of COMMENTS) {
    const postOwnerIdx = POSTS[c.postIdx].userIdx;
    if (c.userIdx !== postOwnerIdx) {
      const postId = postIds[c.postIdx];
      db.prepare(`
        INSERT INTO notifications (user_id, type, actor_id, post_id, read, created_at)
        VALUES (?, 'comment', ?, ?, ?, ?)
      `).run(userIds[postOwnerIdx], userIds[c.userIdx], postId, randomInt(0, 1), pastDate(randomInt(0, 5)));
      notifCount++;
    }
  }

  for (let i = 1; i < userIds.length; i++) {
    db.prepare(`
      INSERT INTO notifications (user_id, type, actor_id, read, created_at)
      VALUES (?, 'follow', ?, ?, ?)
    `).run(userIds[0], userIds[i], 1, pastDate(randomInt(25, 35)));
    notifCount++;
  }

  logInfo(`  Created ${notifCount} notifications`);
  logInfo("");

  logInfo("Creating invites...");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO invites (token, invited_by, used, used_by, expires_at, created_at) VALUES (?, ?, 1, ?, ?, ?)`)
    .run(crypto.randomUUID(), userIds[0], userIds[1], expiresAt, pastDate(45));
  db.prepare(`INSERT INTO invites (token, invited_by, used, used_by, expires_at, created_at) VALUES (?, ?, 1, ?, ?, ?)`)
    .run(crypto.randomUUID(), userIds[0], userIds[2], expiresAt, pastDate(42));
  db.prepare(`INSERT INTO invites (token, invited_by, used, used_by, expires_at, created_at) VALUES (?, ?, 1, ?, ?, ?)`)
    .run(crypto.randomUUID(), userIds[1], userIds[3], expiresAt, pastDate(38));

  db.prepare(`INSERT INTO invites (token, invited_by, used, expires_at, created_at) VALUES (?, ?, 0, ?, ?)`)
    .run(crypto.randomUUID(), userIds[0], expiresAt, pastDate(5));
  db.prepare(`INSERT INTO invites (token, invited_by, used, expires_at, created_at) VALUES (?, ?, 0, ?, ?)`)
    .run(crypto.randomUUID(), userIds[1], expiresAt, pastDate(3));
  db.prepare(`INSERT INTO invites (token, invited_by, used, expires_at, created_at) VALUES (?, ?, 0, ?, ?)`)
    .run(crypto.randomUUID(), userIds[4], expiresAt, pastDate(1));

  logInfo("  Created 3 used invites, 3 unused invites");
  logInfo("");
  logInfo("Seed complete.");
  logInfo(`Database: ${dbPath}`);
}

seed().catch(() => {
  logError("Seed failed.");
  process.exitCode = 1;
});
