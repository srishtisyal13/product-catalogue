import type { Category, CategoryPage, Product } from "@catalogue/shared";
import { NotFoundError } from "../domain/errors.ts";
import type { Logger, ProductRepository } from "../domain/ports.ts";
import { toSearchTerms } from "../domain/search.ts";

export type CatalogueServiceOptions = {
  products: ProductRepository;
  /** Owner-chosen "top rated" products, in display order. */
  featuredProductIds: string[];
  /** How many products the "top rated" section on a category page shows. */
  topRatedPerCategory: number;
  logger: Logger;
};

/** Business rules for browsing and searching the catalogue. */
export class CatalogueService {
  readonly #products: ProductRepository;
  readonly #featuredIds: string[];
  readonly #topRatedPerCategory: number;
  readonly #logger: Logger;

  constructor(options: CatalogueServiceOptions) {
    this.#products = options.products;
    this.#featuredIds = options.featuredProductIds;
    this.#topRatedPerCategory = options.topRatedPerCategory;
    this.#logger = options.logger;
  }

  /** The owner's chosen products, in the configured order. Missing IDs are skipped. */
  async getFeatured(): Promise<Product[]> {
    const results = await Promise.all(this.#featuredIds.map((id) => this.#products.getById(id)));
    const missing = this.#featuredIds.filter((_, index) => results[index] === null);
    if (missing.length > 0) {
      this.#logger.warn({ event: "featured.missing", missing }, "Featured products not found");
    }
    return results.filter((product): product is Product => product !== null);
  }

  listCategories(): Promise<Category[]> {
    return this.#products.listCategories();
  }

  async getCategoryPage(slug: string): Promise<CategoryPage> {
    const category = (await this.#products.listCategories()).find((c) => c.slug === slug);
    if (!category) throw new NotFoundError(`Category "${slug}" not found`);

    const products = await this.#products.listByCategory(slug);
    return {
      category,
      ...splitTopRated(products, this.#featuredIds, this.#topRatedPerCategory),
    };
  }

  async search(term: string): Promise<Product[]> {
    // Nothing meaningful to search for (blank, punctuation or only filler words).
    if (toSearchTerms(term).length === 0) return [];
    return this.#products.search(term);
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.#products.getById(id);
    if (!product) throw new NotFoundError(`Product "${id}" not found`);
    return product;
  }
}

/**
 * "Top rated" for a category: the owner's featured products in that category
 * come first (in featured order), then the highest-rated of the rest, up to
 * the limit. Everything else is "others". No product appears in both lists.
 */
export function splitTopRated(
  products: Product[],
  featuredIds: string[],
  limit: number,
): { topRated: Product[]; others: Product[] } {
  const featuredRank = new Map(featuredIds.map((id, index) => [id, index]));
  const rank = (product: Product) => featuredRank.get(product.id) ?? Number.MAX_SAFE_INTEGER;

  const featured = products.filter((p) => featuredRank.has(p.id)).sort((a, b) => rank(a) - rank(b));
  const byRating = products
    .filter((p) => !featuredRank.has(p.id))
    .sort((a, b) => b.rating.rate - a.rating.rate || b.rating.count - a.rating.count);

  const topRated = [...featured, ...byRating].slice(0, limit);
  const topRatedIds = new Set(topRated.map((p) => p.id));
  const others = products.filter((p) => !topRatedIds.has(p.id));
  return { topRated, others };
}
