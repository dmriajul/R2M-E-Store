import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createOrder, listOrdersForEmail } from "@/lib/data/orders";
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
      { data: null, error: `${method.name} is not available yet`, success: false },
      { status: 400 },
    );
  }

  // Re-price every line from the catalogue so a tampered client can't set prices.
  const { products } = await findProductsByIds(
    values.items.map((line) => line.productId),
  );
  const priceOf = new Map(products.map((product) => [product.id, product.price]));

  const items = values.items.map((line) => ({
    ...line,
    price: priceOf.get(line.productId) ?? line.price,
    name: products.find((product) => product.id === line.productId)?.name ?? line.name,
  }));

  const stockShortages = items
    .filter((line) => {
      const product = products.find((entry) => entry.id === line.productId);
      return product ? product.stock < line.quantity : false;
    })
    .map((line) => line.name);

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

  const session = await auth();
  const input: CreateOrderInput = { ...values, items };

  const { order, source } = await createOrder(input, {
    id: session?.user?.id,
    name: session?.user?.name ?? values.contact.name,
    email: session?.user?.email ?? values.contact.email,
  });

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
}

/* -------------------------------------------------------------------------- */
/*  GET — the signed-in shopper's orders                                       */
/* -------------------------------------------------------------------------- */

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<OrderRecord[]>>> {
  const session = await auth();
  const email = session?.user?.email ?? request.nextUrl.searchParams.get("email") ?? undefined;

  if (!session?.user && !email) {
    return NextResponse.json(
      { data: null, error: "Sign in to view your orders", success: false },
      { status: 401 },
    );
  }

  if (!session?.user && email) {
    // Demo convenience: the mock catalogue has no auth, so allow an explicit email.
    const { orders, source } = await listOrdersForEmail(email);
    return NextResponse.json({ data: orders, error: null, success: true, source });
  }

  const { orders, source } = await listOrdersForEmail(email!);
  return NextResponse.json({ data: orders, error: null, success: true, source });
}
