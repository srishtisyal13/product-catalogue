import { useFeaturedProducts } from "../api/queries";
import { ProductGrid } from "../components/ProductGrid";
import { EmptyState, ErrorMessage, Loading } from "../components/Status";

export function HomePage() {
  const { data: products, error, isPending, refetch } = useFeaturedProducts();

  return (
    <>
      <title>Product Catalogue</title>
      <h1>Top rated products</h1>
      <p className="lead">Our pick of the best products in the catalogue.</p>
      {isPending ? (
        <Loading label="Loading top rated products…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => void refetch()} />
      ) : products.length === 0 ? (
        <EmptyState>No featured products right now. Try browsing a category.</EmptyState>
      ) : (
        <ProductGrid products={products} label="Top rated products" />
      )}
    </>
  );
}
