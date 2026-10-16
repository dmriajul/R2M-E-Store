import { NextResponse, type NextRequest, after } from "next/server";
import { auth, isAdmin } from "@/lib/auth";
import { createOrder } from "@/lib/data/orders";
import { getProductById } from "@/lib/site";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = clientIp(request.headers);
  const rate = limiter.check(ip);
  if (!rate.ok) {
    return NextResponse.json(
      { data: null, error: "Too many requests", success: false, retryAfter: rate.retryAfter },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const staff = await isAdmin();
  const session = await auth();
  if (!staff || !session?.user) {
    return NextResponse.json(
      { data: null, error: "Staff authentication required", success: false },
      { status: 401 },
    );
  }

  const report = {
    orderCreated: false,
    stockDeducted: false,
    emailTriggered: false,
    errors: [] as string[],
  };

  const product = getProductById("dino-graphic-tee");
  if (!product) {
    report.errors.push("Seed product not found");
    return NextResponse.json(report, { status: 500 });
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
      name: session.user.name ?? "Test Staff",
      email: session.user.email ?? "staff@mukra.com",
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
    const { order } = await createOrder(input, {
      id: session.user.id,
      name: session.user.name ?? "Test Staff",
      email: session.user.email ?? "staff@mukra.com",
    });
    report.orderCreated = true;
    report.stockDeducted = true;

    try {
      after(() => {
        void sendOrderConfirmationEmail(order).catch(() => {
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
    report.errors.push(error instanceof Error ? error.message : "Order creation failed");
    return NextResponse.json(report, { status: 500 });
  }
}
