import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { dbUtils } from "../lib/db.js";
import { hashPassword } from "../lib/security.js";
import { COOKIE_NAME, COOKIE_OPTIONS } from "../lib/constants.js";

const LOGO_ICON_NAMES = [
  "Zap", "Rocket", "Sparkles", "Bot", "Cpu", "Terminal", "Code", "Braces",
  "MessageSquare", "MessagesSquare", "Send", "Mail", "AtSign", "Circle",
  "Square", "Triangle", "Hexagon", "Star", "Heart", "Diamond", "Flame",
  "Sun", "Moon", "Cloud", "Leaf", "Mountain", "Ghost", "Smile", "Trophy",
  "ChessKnight", "ChessQueen", "Atom", "BadgeDollarSign", "Bookmark",
  "Cat", "Dog", "Fish", "Coffee", "Pizza", "IceCream", "Gem", "Command",
  "Hash", "Flag", "Pin", "Home", "Library", "Cherry", "Sprout", "Sword"
];

const SetupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(1),
  displayName: z.string().min(1),
  appName: z.string().max(50).optional(),
  logoIcon: z.string().refine((v) => !v || LOGO_ICON_NAMES.includes(v)).optional(),
});

function formatUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    role: user.role,
    createdAt: user.created_at,
  };
}

export const setupRouter = new Hono();

setupRouter.get("/status", (c) => {
  const needsSetup = dbUtils.needsSetup();
  return c.json({ needsSetup });
});

setupRouter.post("/complete", async (c) => {
  if (!dbUtils.needsSetup()) {
    return c.json({ error: "Setup already completed" }, 400);
  }

  try {
    const body = await c.req.json();
    const { email, password, username, displayName, appName, logoIcon } = SetupSchema.parse(body);
    const normalizedEmail = email.trim().toLowerCase();

    const passwordHash = await hashPassword(password);
    const userId = dbUtils.createUser(normalizedEmail, username, displayName, passwordHash, "admin");

    if (appName !== undefined || logoIcon !== undefined) {
      dbUtils.setSettings({ appName, logoIcon });
    }

    const { sessionId } = dbUtils.createSession(userId);
    setCookie(c, COOKIE_NAME, sessionId, COOKIE_OPTIONS);

    const user = dbUtils.getUserById(userId);
    return c.json(formatUser(user), 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.errors }, 400);
    }
    return c.json({ error: "Setup failed" }, 500);
  }
});
