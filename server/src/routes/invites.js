import { Hono } from "hono";
import { dbUtils } from "../lib/db.js";
import { ensureSession, requireRole } from "../middleware/auth.js";

export const invitesRouter = new Hono();

function maskToken(token) {
  return token.length <= 8 ? token : `...${token.slice(-8)}`;
}

invitesRouter.get("/:token", (c) => {
  const token = c.req.param("token");
  const invite = dbUtils.getInviteByToken(token);

  if (!invite) return c.json({ valid: false }, 404);
  if (invite.used) return c.json({ valid: false, error: "Already used" }, 400);
  if (invite.revoked_at) return c.json({ valid: false, error: "Invite revoked" }, 400);
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return c.json({ valid: false, error: "Invite expired" }, 400);
  }

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

invitesRouter.post("/", ensureSession, requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const { token, expiresAt } = dbUtils.createInvite(currentUser.id);
  dbUtils.createAuditEntry(currentUser.id, "INVITE_CREATED", "invite", null, { tokenSuffix: maskToken(token) });
  return c.json({ token, expiresAt }, 201);
});

invitesRouter.get("/", ensureSession, requireRole("admin"), (c) => {
  const invites = dbUtils.listInvites();
  return c.json(invites.map(i => ({
    token: i.token,
    used: Boolean(i.used),
    createdAt: i.created_at,
    expiresAt: i.expires_at,
    revokedAt: i.revoked_at,
    invitedBy: i.invited_by ? {
      id: String(i.invited_by),
      username: i.inviter_username,
      displayName: i.inviter_name,
    } : undefined,
    usedBy: i.used_by_username ? {
      id: String(i.used_by),
      username: i.used_by_username,
      displayName: i.used_by_name,
    } : undefined,
  })));
});

invitesRouter.post("/:token/revoke", ensureSession, requireRole("admin"), (c) => {
  const currentUser = c.get("user");
  const token = c.req.param("token");
  const invite = dbUtils.getInviteByToken(token);

  if (!invite) return c.json({ error: "Invite not found" }, 404);
  if (invite.used) return c.json({ error: "Invite already used" }, 400);
  if (invite.revoked_at) return c.json({ error: "Invite already revoked" }, 400);

  const revokedAt = dbUtils.revokeInviteByToken(token);
  dbUtils.createAuditEntry(currentUser.id, "INVITE_REVOKED", "invite", null, { tokenSuffix: maskToken(token) });
  return c.json({ token, revokedAt });
});
