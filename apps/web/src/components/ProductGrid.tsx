import type { Product } from "@catalogue/shared";
import { Link } from "react-router";
import { formatPrice } from "../format";
import { Rating } from "./Rating";

export function ProductGrid({ products, label }: { products: Product[]; label: string }) {
  return (
    <ul className="product-grid" aria-label={label}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductTile product={product} />
        </li>
      ))}
    </ul>
  );
}

export function ProductTile({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.id}`} className="product-tile">
      <div className="product-tile__image">
        <img src={product.imageUrl} alt="" loading="lazy" />
      </div>
      <h3 className="product-tile__title">{product.title}</h3>
      <p className="product-tile__price">{formatPrice(product.price)}</p>
      <Rating rating={product.rating} />
    </Link>
  );
}
