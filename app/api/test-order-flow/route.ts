import { NextResponse, type NextRequest, after } from "next/server";
import { requireActionRole } from "@/lib/auth";
import { createOrder } from "@/lib/data/orders";
import { listProducts } from "@/lib/data/products";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { data: null, error: "Not found", success: false },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const gate = await requireActionRole(["SUPER_ADMIN"]);
  if (!gate.ok) {
    return NextResponse.json(
      { data: null, error: gate.message, success: false },
      {
        status: gate.reason === "unauthenticated" ? 401 : 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const ip = clientIp(request.headers);
  const rate = limiter.check(`${gate.user.id}:${ip}`);
  if (!rate.ok) {
    return NextResponse.json(
      { data: null, error: "Too many requests", success: false, retryAfter: rate.retryAfter },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } },
    );
  }

  const report = {
    orderCreated: false,
    stockDeducted: false,
    emailTriggered: false,
    errors: [] as string[],
  };

  const { products } = await listProducts({ limit: 1 });
  const product = products[0];
  if (!product) {
    report.errors.push(
      "No active product in the catalogue — add products before testing the order flow",
    );
    return NextResponse.json(report, { status: 503 });
  }

  const input = {
    items: [
      {
        productId: product.id,
        name: product.name,
        color: product.colors[0] ?? "Mint",
        size: product.sizes[0] ?? "4T",
        quantity: 1,
        price: product.price,
      },
    ],
    contact: {
      name: gate.user.name || "Test Staff",
      email: gate.user.email || "staff@mukra.com",
      phone: "+8801700000000",
    },
    shipping: {
      address: "MUKRA Test Address, Road 1",
      city: "Dhaka",
      zip: "1205",
      country: "Bangladesh",
      method: "standard" as const,
      giftWrap: false,
    },
    payment: { method: "COD" as const },
  };

  try {
    const { order, source } = await createOrder(input, {
      id: gate.user.id,
      name: gate.user.name || "Test Staff",
      email: gate.user.email || "staff@mukra.com",
    });
    report.orderCreated = true;
    report.stockDeducted = source === "database";

    try {
      after(async () => {
        await sendOrderConfirmationEmail(order).catch(() => {
          // Swallowed.
        });
      });
      report.emailTriggered = true;
    } catch {
      void sendOrderConfirmationEmail(order).catch(() => {
        // Outside request scope.
      });
      report.emailTriggered = true;
    }

    return NextResponse.json({ ...report, orderNumber: order.orderNumber });
  } catch (error) {
    void error;
    report.errors.push("Order creation failed. Check storage configuration and available stock.");
    return NextResponse.json(report, { status: 500 });
  }
}
