import { dbUtils } from "./lib/db.js";
import { hashPassword } from "./lib/security.js";
import { logInfo, logError } from "./lib/logging.js";

async function seed() {
  logInfo("Seeding database...");

  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const username = process.env.ADMIN_USERNAME || "admin";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "Admin";
  const password = process.env.ADMIN_PASSWORD || "changeme123";

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
