import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession, requireRole } from "../middleware/auth.js";

const LOGO_ICON_NAMES = [
  "Zap", "Rocket", "Sparkles", "Bot", "Cpu", "Terminal", "Code", "Braces",
  "MessageSquare", "MessagesSquare", "Send", "Mail", "AtSign", "Circle",
  "Square", "Triangle", "Hexagon", "Star", "Heart", "Diamond", "Flame",
  "Sun", "Moon", "Cloud", "Leaf", "Mountain", "Ghost", "Smile", "Trophy",
  "ChessKnight", "ChessQueen", "Atom", "BadgeDollarSign", "Bookmark",
  "Cat", "Dog", "Fish", "Coffee", "Pizza", "IceCream", "Gem", "Command",
  "Hash", "Flag", "Pin", "Home", "Library", "Cherry", "Sprout", "Sword"
];

export const settingsRouter = new Hono();

settingsRouter.get("/", (c) => {
  const settings = dbUtils.getAllSettings();
  return c.json(settings);
});

settingsRouter.put("/", ensureSession, requireRole("admin"), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { appName, logoIcon } = body;

  if (appName !== undefined) {
    if (typeof appName !== "string" || appName.length > 50) {
      return c.json({ error: "App name must be a string with max 50 characters" }, 400);
    }
  }

  if (logoIcon !== undefined) {
    if (!LOGO_ICON_NAMES.includes(logoIcon)) {
      return c.json({ error: "Invalid logo icon" }, 400);
    }
  }

  dbUtils.setSettings({ appName, logoIcon });
  const settings = dbUtils.getAllSettings();
  return c.json(settings);
});
