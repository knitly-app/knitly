import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";
import { sanitizeText } from "../lib/sanitize.js";

export const chatRouter = new Hono();

const MAX_MESSAGE_LENGTH = 500;

const messageLimits = new Map();
const MESSAGE_RATE_LIMIT = 1000;
const MESSAGE_BURST = 5;

function checkMessageRateLimit(userId) {
  const now = Date.now();
  const key = `chat:${userId}`;
  let entry = messageLimits.get(key);

  if (!entry || now - entry.windowStart >= 60000) {
    entry = { count: 0, windowStart: now, lastMessage: 0 };
  }

  const timeSinceLast = now - entry.lastMessage;
  if (entry.count >= MESSAGE_BURST && timeSinceLast < MESSAGE_RATE_LIMIT) {
    return false;
  }

  entry.count++;
  entry.lastMessage = now;
  messageLimits.set(key, entry);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of messageLimits) {
    if (now - entry.windowStart >= 60000) {
      messageLimits.delete(key);
    }
  }
}, 60000);

function formatMessage(msg) {
  return {
    id: String(msg.id),
    userId: String(msg.user_id),
    username: msg.username,
    displayName: msg.display_name,
    avatar: msg.avatar || undefined,
    role: msg.role || undefined,
    content: msg.content,
    createdAt: msg.created_at,
  };
}

chatRouter.get("/messages", ensureSession, async (c) => {
  const since = parseInt(c.req.query("since") || "0", 10);

  dbUtils.cleanupOldChatMessages(24);

  const messages = dbUtils.getChatMessages(since, 100);

  return c.json({
    messages: messages.map(formatMessage),
  });
});

chatRouter.post("/messages", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json();

  const rawContent = typeof body.content === "string" ? body.content.trim() : "";
  if (!rawContent) {
    return c.json({ error: "Message content required" }, 400);
  }

  if (rawContent.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, 400);
  }

  if (!checkMessageRateLimit(currentUser.id)) {
    return c.json({ error: "Slow down! You're sending messages too fast." }, 429);
  }

  const content = sanitizeText(rawContent);

  const duplicate = dbUtils.getRecentChatMessage(currentUser.id, content, 30);
  if (duplicate) {
    return c.json({ error: "Duplicate message" }, 400);
  }

  const message = dbUtils.createChatMessage(currentUser.id, content);

  return c.json(formatMessage(message), 201);
});

let previousOnlineUserIds = new Set();

chatRouter.post("/presence", ensureSession, async (c) => {
  const currentUser = c.get("user");

  dbUtils.updateChatPresence(currentUser.id);
  dbUtils.cleanupStalePresence(60);

  const onlineUsers = dbUtils.getChatOnlineUsers(60);
  const currentOnlineIds = new Set(onlineUsers.map((u) => u.user_id));

  const joins = [];
  const leaves = [];

  for (const user of onlineUsers) {
    if (!previousOnlineUserIds.has(user.user_id)) {
      joins.push(user.username);
    }
  }

  for (const userId of previousOnlineUserIds) {
    if (!currentOnlineIds.has(userId)) {
      const leftUser = dbUtils.getUserById(userId);
      if (leftUser) {
        leaves.push(leftUser.username);
      }
    }
  }

  previousOnlineUserIds = currentOnlineIds;

  return c.json({
    online: onlineUsers.length,
    users: onlineUsers.map((u) => u.username),
    joins,
    leaves,
  });
});

chatRouter.get("/status", ensureSession, async (c) => {
  const onlineUsers = dbUtils.getChatOnlineUsers(60);
  return c.json({ online: onlineUsers.length });
});

chatRouter.post("/leave", ensureSession, async (c) => {
  const currentUser = c.get("user");
  dbUtils.removeChatPresence(currentUser.id);
  return c.json({ success: true });
});
