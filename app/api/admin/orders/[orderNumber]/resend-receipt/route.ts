import { NextResponse, type NextRequest } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { rolesForPermission } from "@/lib/rbac";
import { getPrisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { MailjetError, sendMailjetEmail } from "@/lib/mailjet";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ orderNumber: string }>;
}

interface ReceiptItem {
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
}

interface ReceiptOrder {
  orderNumber: string;
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  subtotal: number;
  shipping: number;
  discount: number;
  giftWrap: number;
  total: number;
  createdAt: Date;
  items: ReceiptItem[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
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

function receiptHtml(order: ReceiptOrder): string {
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
  const date = order.createdAt.toLocaleDateString("en-BD", {
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
      <p style="margin:24px 0 4px">Hello ${escapeHtml(order.shippingName)},</p>
      <p style="margin:0;color:#6b7280">Thank you for shopping with MUKRA.</p>
      <section style="margin-top:24px">
        <strong>Order ${escapeHtml(order.orderNumber)}</strong>
        <span style="float:right;color:#6b7280">${date}</span>
        <p style="margin:8px 0;color:#6b7280">${escapeHtml(order.shippingEmail)} · ${escapeHtml(order.shippingPhone)}</p>
        <p style="margin:0;color:#6b7280">${escapeHtml(order.shippingAddress)}, ${escapeHtml(order.shippingCity)} ${escapeHtml(order.shippingZip)}</p>
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

export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const gate = await requireActionRole(rolesForPermission("orders:write"));
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: gate.message, success: false },
      { status: gate.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const { orderNumber } = await context.params;
  const normalizedOrderNumber = orderNumber.trim().replace(/^#/, "");
  if (!normalizedOrderNumber || normalizedOrderNumber.length > 80) {
    return NextResponse.json(
      { data: null, error: "Invalid order number", success: false },
      { status: 400 },
    );
  }

  const db = await getPrisma();
  if (!db) {
    return NextResponse.json(
      { data: null, error: "Receipt sending requires a configured database.", success: false },
      { status: 503 },
    );
  }

  const row = (await db.order.findUnique({
    where: { orderNumber: normalizedOrderNumber },
    include: { items: true },
  })) as ReceiptOrder | null;
  if (!row) {
    return NextResponse.json(
      { data: null, error: "Order not found in the database.", success: false },
      { status: 404 },
    );
  }
  if (!row.shippingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.shippingEmail)) {
    return NextResponse.json(
      { data: null, error: "The order does not have a valid customer email address.", success: false },
      { status: 422 },
    );
  }

  try {
    await sendMailjetEmail({
      to: row.shippingEmail,
      subject: `Your MUKRA receipt for order ${row.orderNumber}`,
      html: receiptHtml(row),
      text: `Thank you for shopping with MUKRA.\nOrder: ${row.orderNumber}\nTotal: ${formatPrice(row.total)}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: error instanceof MailjetError ? error.message : "Could not send the receipt email.",
        success: false,
      },
      { status: error instanceof MailjetError ? error.status : 502 },
    );
  }

  return NextResponse.json({
    data: { email: row.shippingEmail },
    error: null,
    success: true,
    message: "Receipt sent via Mailjet",
    source: "database",
  });
}
