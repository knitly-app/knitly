import { Database } from "bun:sqlite";

const dbPath = process.env.DATABASE_PATH || "../knitly.db";
const db = new Database(dbPath);

const now = Date.now();
const result = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);

console.log(`Deleted ${result.changes} expired session(s)`);

db.close();
