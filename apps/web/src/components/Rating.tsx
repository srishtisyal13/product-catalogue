import type { Product } from "@catalogue/shared";

export function Rating({ rating }: { rating: Product["rating"] }) {
  return (
    <p className="rating">
      <span aria-hidden="true">★ </span>
      {rating.rate.toFixed(1)}
      <span className="rating__count"> ({rating.count} reviews)</span>
    </p>
  );
}
