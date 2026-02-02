import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession } from "../middleware/auth.js";

export const invitesRouter = new Hono();

invitesRouter.get("/:token", async (c) => {
  const token = c.req.param("token");
  const invite = dbUtils.getInviteByToken(token);

  if (!invite) return c.json({ valid: false }, 404);
  if (invite.used) return c.json({ valid: false, error: "Already used" }, 400);

  const inviter = invite.invited_by ? dbUtils.getUserById(invite.invited_by) : null;

  return c.json({
    valid: true,
    inviter: inviter ? {
      id: String(inviter.id),
      username: inviter.username,
      displayName: inviter.display_name,
      avatar: inviter.avatar || undefined,
    } : undefined,
  });
});

invitesRouter.post("/", ensureSession, async (c) => {
  const currentUser = c.get("user");
  const { token, expiresAt } = dbUtils.createInvite(currentUser.id);
  return c.json({ token, expiresAt }, 201);
});

invitesRouter.get("/", ensureSession, async (c) => {
  const invites = dbUtils.listInvites();
  return c.json(invites.map(i => ({
    token: i.token,
    used: Boolean(i.used),
    usedBy: i.used_by_username ? {
      id: String(i.used_by),
      username: i.used_by_username,
    } : undefined,
  })));
});
