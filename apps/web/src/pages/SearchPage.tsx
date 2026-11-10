import { useSearchParams } from "react-router";
import { useProductSearch } from "../api/queries";
import { ProductGrid } from "../components/ProductGrid";
import { EmptyState, ErrorMessage, Loading } from "../components/Status";

export function SearchPage() {
  const [params] = useSearchParams();
  const term = (params.get("q") ?? "").trim();
  const { data: products, error, isPending, refetch } = useProductSearch(term);

  if (!term) {
    return (
      <>
        <h1>Search</h1>
        <EmptyState>Enter a search term to find products.</EmptyState>
      </>
    );
  }

  return (
    <>
      <title>{`Search: ${term} | Product Catalogue`}</title>
      <h1>Results for “{term}”</h1>
      {isPending ? (
        <Loading label="Searching…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => void refetch()} />
      ) : products.length === 0 ? (
        <EmptyState>No products match “{term}”. Try a different word.</EmptyState>
      ) : (
        <>
          <p className="lead" role="status">
            {products.length} {products.length === 1 ? "product" : "products"} found
          </p>
          <ProductGrid products={products} label="Search results" />
        </>
      )}
    </>
  );
}
