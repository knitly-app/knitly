import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { useLocalStorage } from "./lib/media.js";
import { logInfo } from "./lib/logging.js";

import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { postsRouter } from "./routes/posts.js";
import { feedRouter } from "./routes/feed.js";
import { notificationsRouter } from "./routes/notifications.js";
import { searchRouter } from "./routes/search.js";
import { invitesRouter } from "./routes/invites.js";
import { adminRouter } from "./routes/admin.js";
import { mediaRouter } from "./routes/media.js";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "/api/*",
    cors({
      origin: (origin) => {
        if (process.env.NODE_ENV !== "production") {
          return origin || "*";
        }
        return origin;
      },
      credentials: true,
    })
  );

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.route("/api/auth", authRouter);
  app.route("/api/users", usersRouter);
  app.route("/api/posts", postsRouter);
  app.route("/api/feed", feedRouter);
  app.route("/api/notifications", notificationsRouter);
  app.route("/api/search", searchRouter);
  app.route("/api/invites", invitesRouter);
  app.route("/api/admin", adminRouter);
  app.route("/api/media", mediaRouter);

  if (useLocalStorage) {
    app.use("/uploads/*", serveStatic({ root: "../" }));
    logInfo("Local uploads enabled.");
  }

  return app;
}
