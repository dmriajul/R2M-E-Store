import { CATEGORY_META, getProductById } from "@/lib/site";
import { buildLineId, type Address, type CartItem, type DashboardOrder, type OrderTimelineStep } from "@/types";
import type { OrderRecord } from "@/types";

export function toDashboardOrder(order: OrderRecord): DashboardOrder {
  const status: DashboardOrder["status"] =
    order.status === "DELIVERED"
      ? "delivered"
      : order.status === "SHIPPED"
        ? "shipped"
        : order.status === "CANCELLED"
          ? "cancelled"
          : "processing";
  const items: CartItem[] = order.items.map((line, index) => {
    const product = getProductById(line.productId);
    const category = product?.category ?? "Accessories";
    return {
      lineId: `${buildLineId(line.productId, line.color, line.size)}-${index}`,
      orderItemId: line.id,
      availableSizes: line.availableSizes,
      availableColors: line.availableColors,
      productId: line.productId,
      id: line.productId,
      name: line.name,
      price: line.price,
      quantity: line.quantity,
      color: line.color,
      size: line.size,
      ageRange: product?.ageRange ?? "All ages",
      imageGradient: CATEGORY_META[category].gradient,
      emoji: CATEGORY_META[category].emoji,
      stock: product?.stock ?? 0,
      addedAt: order.createdAt,
    };
  });

  const address: Address = {
    id: `order-address-${order.id}`,
    label: "Delivery address",
    fullName: order.customerName,
    line1: order.address,
    city: order.city,
    postalCode: order.zip,
    country: order.country,
    phone: order.phone,
    isDefault: false,
  };
  const timeline: OrderTimelineStep[] = [
    { key: "placed", label: "Order Placed", emoji: "🧾", timestamp: order.createdAt, state: "done" },
    {
      key: "paid",
      label: "Payment",
      emoji: "💳",
      timestamp: order.paymentStatus === "PAID" ? order.createdAt : "",
      state: order.paymentStatus === "PAID" ? "done" : "pending",
    },
    { key: "processing", label: "Processing", emoji: "📦", timestamp: "", state: "pending" },
    {
      key: "shipped",
      label: "Shipped",
      emoji: "🚚",
      timestamp: order.status === "SHIPPED" || order.status === "DELIVERED" ? order.createdAt : "",
      state: order.status === "SHIPPED" ? "current" : order.status === "DELIVERED" ? "done" : "pending",
    },
    {
      key: "delivered",
      label: "Delivered",
      emoji: "🏠",
      timestamp: status === "delivered" ? order.createdAt : "",
      state: status === "delivered" ? "done" : "pending",
    },
  ];

  return {
    id: order.id,
    number: order.orderNumber,
    placedAt: order.createdAt,
    status,
    items,
    totals: {
      subtotal: order.subtotal,
      shipping: order.shipping,
      giftWrap: order.giftWrap,
      discount: order.discount,
      total: order.total,
    },
    deliveryNote: status === "delivered" ? "Delivered" : status === "shipped" ? "On the way" : status === "cancelled" ? "Cancelled" : "Being prepared",
    timeline,
    shipping: {
      fullName: order.customerName,
      address,
      carrier: "MUKRA delivery",
      trackingNumber: order.trackingNumber ?? "Not available",
    },
    payment: {
      label: order.paymentMethod,
      status: order.paymentStatus === "REFUNDED" ? "refunded" : order.paymentStatus === "PAID" ? "paid" : "pending",
    },
  };
}
