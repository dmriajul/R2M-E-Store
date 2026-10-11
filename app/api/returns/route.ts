import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { returnRequestInclude, hydrateReturnRequest } from "@/lib/data/returns";
import { getPrisma } from "@/lib/prisma";
import { returnRequestSchema } from "@/lib/validations";
import type { ApiResponse, ReturnRequestRecord } from "@/types";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ReturnRequestRecord[]>>> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ data: null, error: "Sign in to view return requests", success: false }, { status: 401 });
  }

  const db = await getPrisma();
  if (!db) {
    return NextResponse.json({ data: null, error: "Return requests require a configured database", success: false }, { status: 503 });
  }

  const orderId = request.nextUrl.searchParams.get("orderId");
  const rows = (await db.returnRequest.findMany({
    where: { userId: session.user.id, ...(orderId ? { orderId } : {}) },
    include: returnRequestInclude,
    orderBy: { createdAt: "desc" },
  })) as unknown as Record<string, unknown>[];

  return NextResponse.json({
    data: rows.map(hydrateReturnRequest),
    error: null,
    success: true,
    source: "database",
  });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ReturnRequestRecord[]>>> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ data: null, error: "Sign in to request a return", success: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: "Expected a JSON body", success: false }, { status: 400 });
  }
  const parsed = returnRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({
      data: null,
      error: parsed.error.issues[0]?.message ?? "Invalid return request",
      success: false,
    }, { status: 422 });
  }

  const db = await getPrisma();
  if (!db) {
    return NextResponse.json({ data: null, error: "Return requests require a configured database", success: false }, { status: 503 });
  }

  const order = (await db.order.findFirst({
    where: { id: parsed.data.orderId, userId: session.user.id, status: "DELIVERED" },
    include: { items: { include: { product: { select: { sizes: true, colors: true } } } } },
  })) as unknown as Record<string, unknown> | null;
  if (!order) {
    return NextResponse.json({ data: null, error: "Delivered order not found", success: false }, { status: 404 });
  }

  const items = Array.isArray(order.items) ? order.items as Record<string, unknown>[] : [];
  const selectedItems = parsed.data.orderItemIds.map((id) => items.find((item) => item.id === id));
  if (selectedItems.some((item) => !item)) {
    return NextResponse.json({ data: null, error: "One or more selected items do not belong to this order", success: false }, { status: 422 });
  }
  const ids = parsed.data.orderItemIds;
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ data: null, error: "Duplicate items are not allowed", success: false }, { status: 422 });
  }

  for (const item of selectedItems) {
    const product = item ? item.product as Record<string, unknown> : {};
    if (
      parsed.data.type === "EXCHANGE" &&
      ((parsed.data.requestedSize && !((product.sizes as string[] | undefined)?.includes(parsed.data.requestedSize))) ||
        (parsed.data.requestedColor && !((product.colors as string[] | undefined)?.includes(parsed.data.requestedColor))))
    ) {
      return NextResponse.json({ data: null, error: "Select an available size and color for the exchange", success: false }, { status: 422 });
    }
  }

  let created: unknown[];
  try {
    created = await db.$transaction(async (tx) => {
      const active = (await tx.returnRequest.findMany({
        where: { orderItemId: { in: ids }, status: { in: ["PENDING", "APPROVED", "RECEIVED"] } },
        select: { orderItemId: true },
      })) as unknown as Array<{ orderItemId: string }>;
      if (active.length > 0) throw new Error("ACTIVE_RETURN_EXISTS");
      const rows: unknown[] = [];
      for (const orderItemId of ids) {
        rows.push(await tx.returnRequest.create({
          data: {
            orderId: parsed.data.orderId,
            userId: session.user.id,
            orderItemId,
            type: parsed.data.type,
            reason: parsed.data.reason,
            details: parsed.data.details || null,
            requestedSize: parsed.data.requestedSize || null,
            requestedColor: parsed.data.requestedColor || null,
            images: parsed.data.images,
          },
          include: returnRequestInclude,
        }));
      }
      return rows;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_RETURN_EXISTS") {
      return NextResponse.json({ data: null, error: "A return request is already active for a selected item", success: false }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({
    data: (created as unknown as Record<string, unknown>[]).map(hydrateReturnRequest),
    error: null,
    success: true,
    source: "database",
  }, { status: 201 });
}
