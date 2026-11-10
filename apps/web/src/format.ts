import type { Product } from "@catalogue/shared";

export function formatPrice(price: Product["price"]): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency }).format(
    price.amount,
  );
}
