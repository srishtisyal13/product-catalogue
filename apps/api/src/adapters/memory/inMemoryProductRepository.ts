import type { Category, Product } from "@catalogue/shared";
import type { ProductRepository } from "../../domain/ports.ts";
import { searchProducts } from "../../domain/search.ts";

/** A ProductRepository over a fixed list. Used by tests. */
export class InMemoryProductRepository implements ProductRepository {
  readonly #products: Product[];

  constructor(products: Product[]) {
    this.#products = [...products];
  }

  async listAll(): Promise<Product[]> {
    return [...this.#products];
  }

  async getById(id: string): Promise<Product | null> {
    return this.#products.find((product) => product.id === id) ?? null;
  }

  async listCategories(): Promise<Category[]> {
    const bySlug = new Map<string, Category>();
    for (const product of this.#products) bySlug.set(product.category.slug, product.category);
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listByCategory(slug: string): Promise<Product[]> {
    return this.#products.filter((product) => product.category.slug === slug);
  }

  async search(term: string): Promise<Product[]> {
    return searchProducts(this.#products, term);
  }
}
