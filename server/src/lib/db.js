import { db } from "./db/core.js";
import { userQueries } from "./db/users.js";
import { sessionQueries } from "./db/sessions.js";
import { tokenQueries } from "./db/tokens.js";
import { apiKeyQueries } from "./db/apiKeys.js";
import { postQueries } from "./db/posts.js";
import { reactionQueries } from "./db/reactions.js";
import { commentQueries } from "./db/comments.js";
import { pollQueries } from "./db/polls.js";
import { moderationQueries } from "./db/moderation.js";
import { followQueries } from "./db/follows.js";
import { notificationQueries } from "./db/notifications.js";
import { inviteQueries } from "./db/invites.js";
import { circleQueries } from "./db/circles.js";
import { searchQueries } from "./db/search.js";
import { statsQueries } from "./db/stats.js";
import { auditQueries } from "./db/audit.js";
import { settingsQueries } from "./db/settings.js";
import { chatQueries } from "./db/chat.js";

export { db };

export const dbUtils = {
  ...userQueries,
  ...sessionQueries,
  ...tokenQueries,
  ...apiKeyQueries,
  ...postQueries,
  ...reactionQueries,
  ...commentQueries,
  ...pollQueries,
  ...moderationQueries,
  ...followQueries,
  ...notificationQueries,
  ...inviteQueries,
  ...circleQueries,
  ...searchQueries,
  ...statsQueries,
  ...auditQueries,
  ...settingsQueries,
  ...chatQueries,
};

export default db;
