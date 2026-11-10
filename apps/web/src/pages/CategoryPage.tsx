import { useParams } from "react-router";
import { ApiError } from "../api/client";
import { useCategoryPage } from "../api/queries";
import { ProductGrid } from "../components/ProductGrid";
import { EmptyState, ErrorMessage, Loading } from "../components/Status";
import { NotFoundPage } from "./NotFoundPage";

export function CategoryPage() {
  const { slug = "" } = useParams();
  const { data, error, isPending, refetch } = useCategoryPage(slug);

  if (isPending) return <Loading label="Loading category…" />;
  if (error instanceof ApiError && error.isNotFound) {
    return <NotFoundPage message="We couldn't find that category." />;
  }
  if (error) return <ErrorMessage error={error} onRetry={() => void refetch()} />;

  const { category, topRated, others } = data;
  return (
    <>
      <title>{`${category.name} | Product Catalogue`}</title>
      <h1 className="capitalise">{category.name}</h1>

      <section aria-labelledby="top-rated-heading">
        <h2 id="top-rated-heading">Top rated</h2>
        {topRated.length > 0 ? (
          <ProductGrid products={topRated} label={`Top rated in ${category.name}`} />
        ) : (
          <EmptyState>No products in this category yet.</EmptyState>
        )}
      </section>

      <section aria-labelledby="more-heading">
        <h2 id="more-heading">
          More in <span className="capitalise">{category.name}</span>
        </h2>
        {others.length > 0 ? (
          <ProductGrid products={others} label={`More in ${category.name}`} />
        ) : (
          <EmptyState>That's everything in this category.</EmptyState>
        )}
      </section>
    </>
  );
}
