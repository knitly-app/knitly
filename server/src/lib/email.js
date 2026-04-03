import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const fromEmail = process.env.FROM_EMAIL || "noreply@example.com";
const baseUrl = process.env.BASE_URL || "http://localhost:3000";

function wrapEmailHtml(body) {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">${body}</div>`;
}

export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn("[email] No RESEND_API_KEY — skipping email to", to);
    console.warn("[email] Subject:", subject);
    return { success: false, reason: "no_api_key" };
  }
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
  });
  if (error) throw error;
  return { success: true, id: data.id };
}

export function sendPasswordResetEmail(to, token, displayName) {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  return sendEmail({
    to,
    subject: "Reset your password",
    html: wrapEmailHtml(`
        <h2 style="color: #111; margin-bottom: 16px;">Reset your password</h2>
        <p style="color: #555; line-height: 1.6;">
          Hi ${displayName}, we received a request to reset your password. Click the button below to set a new one.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 24px 0;">
          Reset Password
        </a>
        <p style="color: #999; font-size: 14px; line-height: 1.5;">
          This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
        </p>
    `),
  });
}

export function sendEmailChangeConfirmation(token, displayName, newEmail) {
  const confirmUrl = `${baseUrl}/confirm-email?token=${token}`;
  return sendEmail({
    to: newEmail,
    subject: "Confirm your new email address",
    html: wrapEmailHtml(`
        <h2 style="color: #111; margin-bottom: 16px;">Confirm your new email</h2>
        <p style="color: #555; line-height: 1.6;">
          Hi ${displayName}, you requested to change your email to <strong>${newEmail}</strong>. Click below to confirm.
        </p>
        <a href="${confirmUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 24px 0;">
          Confirm Email
        </a>
        <p style="color: #999; font-size: 14px; line-height: 1.5;">
          This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
        </p>
    `),
  });
}

export function sendAccountDeletionEmail(to, displayName, deletionDate) {
  return sendEmail({
    to,
    subject: "Your account is scheduled for deletion",
    html: wrapEmailHtml(`
        <h2 style="color: #111; margin-bottom: 16px;">Account deletion scheduled</h2>
        <p style="color: #555; line-height: 1.6;">
          Hi ${displayName}, your account has been scheduled for deletion on <strong>${deletionDate}</strong>.
        </p>
        <p style="color: #555; line-height: 1.6;">
          If you change your mind, simply log in before that date and your account will be restored automatically.
        </p>
        <p style="color: #999; font-size: 14px; line-height: 1.5;">
          If you didn't request this, please log in immediately to secure your account.
        </p>
    `),
  });
}
