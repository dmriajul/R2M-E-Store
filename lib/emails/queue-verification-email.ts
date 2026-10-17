import { after } from "next/server";
import type { VerificationRecipient } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/emails/send-verification-email";

/** after() extends request lifetime; email failure never changes the committed account. */
export function queueVerificationEmail(recipient: VerificationRecipient): void {
  try {
    after(async () => {
      try {
        await sendVerificationEmail(recipient);
      } catch {
        // Never log the recipient, bearer URL, Mailjet response, or credentials.
        console.error("[verification] Email delivery failed; the customer can request a new link.");
      }
    });
  } catch {
    console.error(
      "[verification] Email could not be scheduled; the customer can request a new link.",
    );
  }
}
