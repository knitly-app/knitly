import { db } from "./db.js";

export function parseMentions(content) {
  if (!content) return [];
  const matches = content.match(/(?<=^|[^@\w])@(\w+)/g) || [];
  return [...new Set(matches.map(m => m.replace(/^@/, "")))];
}

export function resolveMentions(usernames) {
  if (!usernames?.length) return [];
  const placeholders = usernames.map(() => "?").join(", ");
  return db.prepare(`
    SELECT id, username FROM users WHERE username IN (${placeholders})
  `).all(...usernames);
}
