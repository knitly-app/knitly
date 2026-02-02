import { serve } from "@hono/node-server";
import { logInfo } from "./lib/logging.js";
import { createApp } from "./app.js";

const port = parseInt(process.env.PORT || "3000", 10);
logInfo(`Server running on port ${port}.`);

const app = createApp();
serve({ fetch: app.fetch, port });
