import type { Category, Product } from "@catalogue/shared";
import { z } from "zod";
import { UpstreamError } from "../../domain/errors.ts";
import type { ProductRepository } from "../../domain/ports.ts";
import { searchProducts } from "../../domain/search.ts";

/** Fake Store's product shape. Validated so a change upstream fails loudly. */
const fakeStoreProductSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  price: z.number(),
  description: z.string(),
  category: z.string(),
  image: z.string(),
  rating: z.object({ rate: z.number(), count: z.number() }).optional(),
});
type FakeStoreProduct = z.infer<typeof fakeStoreProductSchema>;

export type FakeStoreOptions = {
  baseUrl: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
};

/**
 * Reads products from the Fake Store API and maps them to our Product model.
 * Fake Store has about 20 products and no search or filtering, so every query
 * starts from the full list. Caching is added separately by
 * CachingProductRepository.
 */
export class FakeStoreProductRepository implements ProductRepository {
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: FakeStoreOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#timeoutMs = options.timeoutMs;
    this.#fetch = options.fetchFn ?? fetch;
  }

  async listAll(): Promise<Product[]> {
    const body = await this.#getJson("/products");
    const parsed = z.array(fakeStoreProductSchema).safeParse(body);
    if (!parsed.success) throw new UpstreamError("Fake Store returned an unexpected product list");
    return parsed.data.map(toProduct);
  }

  async getById(id: string): Promise<Product | null> {
    // Fake Store IDs are numbers; anything else can't exist there.
    if (!/^\d{1,10}$/.test(id)) return null;

    const body = await this.#getJson(`/products/${id}`, { notFoundAsNull: true });
    if (body === null) return null;

    const parsed = fakeStoreProductSchema.safeParse(body);
    if (!parsed.success) throw new UpstreamError(`Fake Store returned an unexpected product ${id}`);
    return toProduct(parsed.data);
  }

  async listCategories(): Promise<Category[]> {
    const bySlug = new Map<string, Category>();
    for (const product of await this.listAll()) bySlug.set(product.category.slug, product.category);
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listByCategory(slug: string): Promise<Product[]> {
    return (await this.listAll()).filter((product) => product.category.slug === slug);
  }

  async search(term: string): Promise<Product[]> {
    return searchProducts(await this.listAll(), term);
  }

  /**
   * Fetches JSON with a timeout. With notFoundAsNull, a 404 or an empty body
   * resolves to null: Fake Store answers an unknown product ID with
   * HTTP 200 and an empty body rather than a 404.
   */
  async #getJson(path: string, { notFoundAsNull = false } = {}): Promise<unknown> {
    const url = `${this.#baseUrl}${path}`;
    let text: string;
    let status: number;
    try {
      const response = await this.#fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
      status = response.status;
      text = await response.text();
    } catch (cause) {
      throw new UpstreamError(`Fake Store request failed: GET ${path}`, { cause });
    }

    if (status === 404 && notFoundAsNull) return null;
    if (status < 200 || status >= 300) {
      throw new UpstreamError(`Fake Store responded with HTTP ${status}: GET ${path}`);
    }
    if (text.trim() === "") {
      if (notFoundAsNull) return null;
      throw new UpstreamError(`Fake Store returned an empty body: GET ${path}`);
    }
    try {
      return JSON.parse(text);
    } catch (cause) {
      throw new UpstreamError(`Fake Store returned invalid JSON: GET ${path}`, { cause });
    }
  }
}

export function toProduct(raw: FakeStoreProduct): Product {
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description,
    price: { amount: raw.price, currency: "USD" },
    category: { slug: slugify(raw.category), name: raw.category },
    imageUrl: raw.image,
    rating: raw.rating ?? { rate: 0, count: 0 },
  };
}

/** "men's clothing" becomes "mens-clothing". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
