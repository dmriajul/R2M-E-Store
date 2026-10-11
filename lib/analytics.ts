declare global {
  interface Window {
    gtag?: (
      command: string,
      eventName: string,
      parameters?: Record<string, unknown>,
    ) => void;
  }
}

function sendEvent(eventName: string, parameters: Record<string, unknown>) {
  if (
    typeof window === "undefined" ||
    !process.env.NEXT_PUBLIC_GA_ID ||
    typeof window.gtag !== "function"
  ) {
    return;
  }

  window.gtag("event", eventName, parameters);
}

export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number,
) {
  sendEvent(action, {
    event_category: category,
    ...(label === undefined ? {} : { event_label: label }),
    ...(value === undefined ? {} : { value }),
  });
}

export function trackPurchase(
  orderId: string,
  value: number,
  currency: string = "BDT",
) {
  sendEvent("purchase", {
    transaction_id: orderId,
    value,
    currency,
  });
}

export function trackAddToCart(
  productId: string,
  productName: string,
  price: number,
) {
  sendEvent("add_to_cart", {
    currency: "BDT",
    value: price,
    items: [
      {
        item_id: productId,
        item_name: productName,
        price,
        quantity: 1,
      },
    ],
  });
}
