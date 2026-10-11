export interface MailjetEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class MailjetError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MailjetError";
  }
}

export async function sendMailjetEmail(email: MailjetEmail): Promise<void> {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const senderEmail = process.env.MAILJET_SENDER_EMAIL;

  if (!apiKey || !secretKey || !senderEmail) {
    throw new MailjetError(
      "Receipt email is not configured. Set MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_SENDER_EMAIL.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: senderEmail, Name: "MUKRA" },
            To: [{ Email: email.to }],
            Subject: email.subject,
            TextPart: email.text,
            HTMLPart: email.html,
          },
        ],
      }),
    });
  } catch {
    throw new MailjetError("Could not connect to the Mailjet email service.", 502);
  }

  if (!response.ok) {
    throw new MailjetError("Mailjet rejected the receipt email.", 502);
  }
}
