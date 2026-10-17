import { sendMailjetEmail, type MailjetEmail } from "@/lib/mailjet";
import type { VerificationRecipient } from "@/lib/email-verification";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

/** Use trusted configuration, never a request Host header or a supplied return URL. */
export function verificationEmailLink(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid verification token format");
  const configured = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("Verification email origin is not configured");
  }
  const origin = new URL(configured || "http://localhost:3000");
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    (process.env.NODE_ENV === "production" &&
      process.env.ALLOW_DEMO_MODE !== "true" &&
      origin.protocol !== "https:")
  ) {
    throw new Error("Invalid verification email origin");
  }
  const link = new URL("/api/auth/verify-email", origin.origin);
  link.searchParams.set("token", token);
  return link.href;
}

export function buildVerificationEmail(recipient: VerificationRecipient): MailjetEmail {
  const link = verificationEmailLink(recipient.token);
  const safeLink = escapeHtml(link);
  const name = escapeHtml(recipient.name || "friend");
  return {
    to: recipient.email,
    trackClicks: false,
    trackOpens: false,
    subject: "Verify your email — MUKRA",
    text: `Welcome to MUKRA, ${recipient.name || "friend"}!\n\nVerify My Email: ${link}\n\nThis link expires in 24 hours and can only be used once. If you did not create this account, you can ignore this email.\n\nMUKRA — Where Magic Meets Style`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#080808;color:#f5f2ea;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:40px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141210;border:1px solid #403721;border-radius:20px"><tr><td style="padding:40px 32px">
<p style="margin:0;color:#d4af37;letter-spacing:6px;font-size:28px;font-weight:bold">MUKRA</p>
<p style="margin:10px 0 32px;color:#b8ad96;font-size:11px;letter-spacing:2px">WHERE MAGIC MEETS STYLE</p>
<h1 style="font-size:26px;line-height:1.3;color:#fff9eb">A warm welcome, ${name}.</h1>
<p style="font-size:16px;line-height:1.8;color:#d3ccbd">Your little one’s next favourite outfit awaits. Please confirm your email so we can keep you connected to your MUKRA account and order updates.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td bgcolor="#d4af37" style="border-radius:28px"><a href="${safeLink}" style="display:inline-block;padding:16px 28px;color:#10100c;font-weight:bold;text-decoration:none;font-size:15px">Verify My Email</a></td></tr></table>
<p style="font-size:14px;line-height:1.7;color:#b8ad96">This link expires in <strong style="color:#f5f2ea">24 hours</strong> and can only be used once. Requesting another link replaces this one.</p>
<p style="font-size:12px;line-height:1.8;color:#b8ad96">Button not working? Copy and paste this link into your browser:<br><a href="${safeLink}" style="color:#d4af37;word-break:break-all">${safeLink}</a></p>
<p style="border-top:1px solid #403721;margin-top:28px;padding-top:20px;font-size:12px;line-height:1.7;color:#958c7b">If you didn’t create this account, you can safely ignore this email. Never share this link, your password, or payment PIN.</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}

/** Caller must run this inside after(); failures must never undo registration. */
export async function sendVerificationEmail(recipient: VerificationRecipient): Promise<void> {
  const email = buildVerificationEmail(recipient);
  const configured =
    process.env.MAILJET_API_KEY &&
    process.env.MAILJET_SECRET_KEY &&
    process.env.MAILJET_SENDER_EMAIL;
  if (
    !configured &&
    process.env.NODE_ENV !== "production" &&
    process.env.DEBUG_VERIFICATION_EMAILS === "true"
  ) {
    // Explicit local-only opt-in: this bearer link must never enter production logs.
    console.warn(`[verification:local-only] ${verificationEmailLink(recipient.token)}`);
    return;
  }
  await sendMailjetEmail(email);
}
