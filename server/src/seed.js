import { dbUtils } from "./lib/db.js";
import { hashPassword } from "./lib/security.js";
import { logInfo, logError } from "./lib/logging.js";

async function seed() {
  logInfo("Seeding database...");

  const existingAdmin = dbUtils.getUserByEmail("mike@mk3y.com");
  if (existingAdmin) {
    logInfo("Admin user already exists.");
    return;
  }

  const passwordHash = await hashPassword("password123");
  const userId = dbUtils.createUser(
    "mike@mk3y.com",
    "mike",
    "Mike",
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
