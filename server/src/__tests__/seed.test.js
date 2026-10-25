import { describe, expect, test } from "bun:test";
import { spawn } from "child_process";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";

const SERVER_DIR = join(import.meta.dir, "..", "..");

function runSeed(env) {
  return new Promise((resolve) => {
    const child = spawn("bun", ["run", "src/seed.js"], {
      cwd: SERVER_DIR,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

function baseEnv(dbPath) {
  const env = { ...process.env };
  delete env.ADMIN_EMAIL;
  delete env.ADMIN_PASSWORD;
  delete env.ADMIN_USERNAME;
  delete env.ADMIN_DISPLAY_NAME;
  env.DATABASE_PATH = dbPath;
  return env;
}

describe("seed script", () => {
  test("exits 1 without ADMIN_EMAIL/ADMIN_PASSWORD and creates no user", async () => {
    const dir = mkdtempSync(join(tmpdir(), "knitly-seed-"));
    const dbPath = join(dir, "knitly.db");

    const { code, stderr } = await runSeed(baseEnv(dbPath));

    expect(code).toBe(1);
    expect(stderr).toContain("ADMIN_EMAIL and ADMIN_PASSWORD");

    const db = new Database(dbPath, { readonly: true });
    const count = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    expect(count).toBe(0);
    db.close();
  });

  test("creates admin user when env vars are set", async () => {
    const dir = mkdtempSync(join(tmpdir(), "knitly-seed-"));
    const dbPath = join(dir, "knitly.db");

    const { code } = await runSeed({
      ...baseEnv(dbPath),
      ADMIN_EMAIL: "seed-admin@example.com",
      ADMIN_PASSWORD: "supersecret123",
    });

    expect(code).toBe(0);

    const db = new Database(dbPath, { readonly: true });
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get("seed-admin@example.com");
    expect(user).toBeTruthy();
    expect(user.role).toBe("admin");
    expect(user.password_hash).not.toBeNull();
    db.close();
  });
});
