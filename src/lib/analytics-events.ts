/**
 * Typed e-commerce event functions for PostHog.
 *
 * Every function is a no-op when PostHog has not been initialized,
 * so callers never need to guard.
 */
import { trackEvent } from "./analytics";

interface ProductViewPayload {
  id: string;
  name: string;
  slug: string;
  category?: string;
}

interface AddToCartPayload {
  variantId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface RemoveFromCartPayload {
  variantId: string;
  name: string;
}

interface CheckoutItemPayload {
  name: string;
  price: number;
  quantity: number;
}

export function trackProductView(product: ProductViewPayload): void {
  trackEvent("product_view", {
    product_id: product.id,
    product_name: product.name,
    slug: product.slug,
    category: product.category ?? null,
  });
}

export function trackAddToCart(item: AddToCartPayload): void {
  trackEvent("add_to_cart", {
    variant_id: item.variantId,
    product_id: item.productId,
    product_name: item.name,
    price: item.price,
    quantity: item.quantity,
    value: item.price * item.quantity,
  });
}

export function trackRemoveFromCart(item: RemoveFromCartPayload): void {
  trackEvent("remove_from_cart", {
    variant_id: item.variantId,
    product_name: item.name,
  });
}

export function trackBeginCheckout(items: CheckoutItemPayload[], total: number): void {
  trackEvent("begin_checkout", {
    items: items.map((i) => ({
      product_name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
    total,
  });
}

export function trackPurchase(
  orderId: string,
  orderNumber: string,
  total: number,
  itemCount: number,
): void {
  trackEvent("purchase", {
    order_id: orderId,
    order_number: orderNumber,
    total,
    item_count: itemCount,
    value: total,
  });
}

export function trackSearch(query: string, resultCount: number): void {
  trackEvent("search", {
    search_query: query,
    result_count: resultCount,
  });
}
