import { dbUtils } from "./lib/db.js";
import { hashPassword } from "./lib/security.js";
import { logInfo, logError } from "./lib/logging.js";

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    logError("ADMIN_EMAIL and ADMIN_PASSWORD are required (no defaults).");
    logError("Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpass bun --cwd server run seed");
    process.exit(1);
  }

  logInfo("Seeding database...");

  const username = process.env.ADMIN_USERNAME || "admin";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "Admin";

  const existingAdmin = dbUtils.getUserByEmail(email);
  if (existingAdmin) {
    logInfo("Admin user already exists.");
    return;
  }

  const passwordHash = await hashPassword(password);
  const userId = dbUtils.createUser(
    email,
    username,
    displayName,
    passwordHash,
    "admin"
  );

  if (userId) {
    logInfo("Admin user created.");
  }
  logInfo("Done.");
}

seed().catch(() => {
  logError("Seed failed.");
  process.exitCode = 1;
});
