import { NextResponse, type NextRequest, after } from "next/server";
import { auth } from "@/lib/auth";
import { createOrder, listOrdersForEmail } from "@/lib/data/orders";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { findProductsByIds } from "@/lib/data/products";
import { createOrderSchema } from "@/lib/validations";
import { getPaymentMethod, isManualPayment, renderInstructions } from "@/lib/payments";
import type { ApiResponse, CreateOrderInput, OrderRecord } from "@/types";

export const runtime = "nodejs";

/* -------------------------------------------------------------------------- */
/*  POST — place an order                                                      */
/* -------------------------------------------------------------------------- */

export interface PlaceOrderResponse extends OrderRecord {
  /** Wallet numbers the customer must send money to (manual methods). */
  paymentNumbers?: string[];
  /** Step-by-step copy shown on the confirmation screen. */
  instructions?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<PlaceOrderResponse>>> {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json(
      { data: null, error: "Sign in before placing an order", success: false },
      { status: 401 },
    );
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { data: null, error: "Expected a JSON body", success: false },
        { status: 400 },
      );
    }

    const parsed = createOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        {
          data: null,
          error: issue ? `${issue.path.join(".") || "order"}: ${issue.message}` : "Invalid order",
          success: false,
        },
        { status: 422 },
      );
    }

    const values = parsed.data;
    const method = getPaymentMethod(values.payment.method);

    if (!method.active) {
      return NextResponse.json(
        {
          data: null,
          error: `${method.name} is not available yet`,
          success: false,
        },
        { status: 400 },
      );
    }

    // Re-price every line from the catalogue so a tampered client can't set prices.
    const { products } = await findProductsByIds(values.items.map((line) => line.productId));
    if (values.items.some((line) => !products.some((product) => product.id === line.productId))) {
      return NextResponse.json(
        {
          data: null,
          error: "An item is no longer available. Please update your bag.",
          success: false,
        },
        { status: 409 },
      );
    }
    const priceOf = new Map(products.map((product) => [product.id, product.price]));

    const items = values.items.map((line) => ({
      ...line,
      price: priceOf.get(line.productId)!,
      name: products.find((product) => product.id === line.productId)?.name ?? line.name,
    }));

    const productById = new Map(products.map((product) => [product.id, product]));
    const requestedVariants = new Map<
      string,
      { name: string; quantity: number; available: number }
    >();

    for (const line of items) {
      const product = productById.get(line.productId);
      if (!product) continue;

      const key = `${line.productId}\u0000${line.color}\u0000${line.size}`;
      const variant = product.variants
        ? product.variants.find((entry) => entry.color === line.color && entry.size === line.size)
        : undefined;
      const available = product.variants ? (variant?.stock ?? 0) : product.stock;
      const requested = requestedVariants.get(key);

      requestedVariants.set(key, {
        name: product.name,
        quantity: (requested?.quantity ?? 0) + line.quantity,
        available,
      });
    }

    const stockShortages = Array.from(requestedVariants.values())
      .filter((variant) => variant.quantity > variant.available)
      .map((variant) => variant.name);

    if (stockShortages.length > 0) {
      return NextResponse.json(
        {
          data: null,
          error: `Not enough stock for: ${stockShortages.join(", ")}`,
          success: false,
        },
        { status: 409 },
      );
    }

    const input: CreateOrderInput = {
      ...values,
      items,
      shipping: {
        ...values.shipping,
        method:
          values.shipping.country === "Bangladesh"
            ? values.shipping.city.trim().toLowerCase() === "dhaka"
              ? "standard"
              : "express"
            : values.shipping.method,
      },
    };

    let order;
    let source: "database" | "mock";
    try {
      const result = await createOrder(input, {
        id: session?.user?.id,
        name: session?.user?.name ?? values.contact.name,
        email: session?.user?.email ?? values.contact.email,
      });
      order = result.order;
      source = result.source;
    } catch (error) {
      return NextResponse.json(
        {
          data: null,
          error:
            error instanceof Error &&
            /^(Not enough stock|Variant not found|Product not found)/.test(error.message)
              ? "An item is unavailable or has insufficient stock. Please update your bag."
              : "Could not save your order. Please try again later.",
          success: false,
        },
        {
          status:
            error instanceof Error &&
            /^(Not enough stock|Variant not found|Product not found)/.test(error.message)
              ? 409
              : 503,
        },
      );
    }

    // Fire-and-forget receipt email — must never delay or fail the 201 response.
    try {
      after(async () => {
        await sendOrderConfirmationEmail(order).catch(() => {
          // Email failures are intentionally swallowed.
        });
      });
    } catch {
      void sendOrderConfirmationEmail(order).catch(() => {
        // Outside a request scope: run directly.
      });
    }

    const paymentNumbers =
      isManualPayment(order.paymentMethod) && method.numbers ? [...method.numbers] : undefined;

    return NextResponse.json(
      {
        data: {
          ...order,
          paymentNumbers,
          // Placeholders ({number}, {amount}, {orderNumber}) filled in for the
          // customer's confirmation screen.
          instructions: isManualPayment(order.paymentMethod)
            ? renderInstructions(order.paymentMethod, {
                amount: order.total,
                orderNumber: order.orderNumber,
              })
            : method.instructions,
        },
        error: null,
        success: true,
        source,
      },
      { status: 201 },
    );
  } catch {
    console.error("[orders] Order service unavailable");
    return NextResponse.json(
      {
        data: null,
        error: "Order service is temporarily unavailable",
        success: false,
      },
      { status: 503 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  GET — the signed-in shopper's orders                                       */
/* -------------------------------------------------------------------------- */

export async function GET(): Promise<NextResponse<ApiResponse<OrderRecord[]>>> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { data: null, error: "Sign in to view your orders", success: false },
      { status: 401 },
    );
  }
  try {
    const { orders, source } = await listOrdersForEmail(session.user.email, session.user.id);
    return NextResponse.json({
      data: orders,
      error: null,
      success: true,
      source,
    });
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: "Order service is temporarily unavailable",
        success: false,
      },
      { status: 503 },
    );
  }
}
