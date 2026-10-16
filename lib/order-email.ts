import { sendMailjetEmail } from "@/lib/mailjet";
import { formatPrice } from "@/lib/utils";
import type { OrderRecord } from "@/types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function receiptHtml(order: OrderRecord): string {
  const rows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb">
          ${escapeHtml(item.name)}<br>
          <span style="color:#6b7280">${escapeHtml(item.color)} · ${escapeHtml(item.size)}</span>
        </td>
        <td style="padding:10px 0;text-align:right;border-bottom:1px solid #e5e7eb">${item.quantity}</td>
        <td style="padding:10px 0;text-align:right;border-bottom:1px solid #e5e7eb">${formatPrice(item.price * item.quantity)}</td>
      </tr>`,
    )
    .join("");
  const date = new Date(order.createdAt).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Dhaka",
  });

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f5f5;color:#111827;font-family:Arial,sans-serif">
    <main style="max-width:640px;margin:24px auto;padding:32px;background:#fff">
      <header style="border-bottom:1px solid #e5e7eb;padding-bottom:20px">
        <h1 style="margin:0;color:#111827;letter-spacing:.12em">MUKRA</h1>
        <p style="margin:8px 0 0;color:#6b7280">Order receipt</p>
      </header>
      <p style="margin:24px 0 4px">Hello ${escapeHtml(order.customerName)},</p>
      <p style="margin:0;color:#6b7280">Thank you for shopping with MUKRA.</p>
      <section style="margin-top:24px">
        <strong>Order ${escapeHtml(order.orderNumber)}</strong>
        <span style="float:right;color:#6b7280">${date}</span>
        <p style="margin:8px 0;color:#6b7280">${escapeHtml(order.email)} · ${escapeHtml(order.phone)}</p>
        <p style="margin:0;color:#6b7280">${escapeHtml(order.address)}, ${escapeHtml(order.city)} ${escapeHtml(order.zip)}</p>
      </section>
      <table style="width:100%;margin-top:24px;border-collapse:collapse">
        <thead><tr style="text-align:left"><th style="padding-bottom:8px">Item</th><th style="padding-bottom:8px;text-align:right">Qty</th><th style="padding-bottom:8px;text-align:right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section style="max-width:280px;margin:20px 0 0 auto;color:#4b5563">
        <p style="display:flex;justify-content:space-between">Subtotal <span>${formatPrice(order.subtotal)}</span></p>
        <p style="display:flex;justify-content:space-between">Shipping <span>${formatPrice(order.shipping)}</span></p>
        ${order.giftWrap > 0 ? `<p style="display:flex;justify-content:space-between">Gift wrap <span>${formatPrice(order.giftWrap)}</span></p>` : ""}
        ${order.discount > 0 ? `<p style="display:flex;justify-content:space-between">Discount <span>−${formatPrice(order.discount)}</span></p>` : ""}
        <p style="display:flex;justify-content:space-between;border-top:1px solid #d1d5db;padding-top:12px;color:#111827;font-weight:bold">Total <span>${formatPrice(order.total)}</span></p>
      </section>
      <footer style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;color:#6b7280;font-size:13px">
        Thank you for choosing MUKRA.
      </footer>
    </main>
  </body>
</html>`;
}

/**
 * Sends the order confirmation receipt via Mailjet. Fire-and-forget: callers
 * should invoke this inside `after()` and swallow errors so a mail failure
 * never fails the order.
 */
export async function sendOrderConfirmationEmail(order: OrderRecord): Promise<void> {
  if (!order.email) return;
  await sendMailjetEmail({
    to: order.email,
    subject: `Your MUKRA receipt for order ${order.orderNumber}`,
    html: receiptHtml(order),
    text: `Thank you for shopping with MUKRA.\nOrder: ${order.orderNumber}\nTotal: ${formatPrice(order.total)}`,
  });
}
