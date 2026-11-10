import type { Category, Product } from "@catalogue/shared";
import type { ProductRepository } from "../../domain/ports.ts";
import { toSearchTerms } from "../../domain/search.ts";

type Entry = { expiresAt: number; value: Promise<unknown> };

export type CacheOptions = {
  ttlMs: number;
  /** Upper bound on entries, so unique search terms can't grow memory forever. */
  maxEntries?: number;
  now?: () => number;
};

/**
 * Adds an in-memory time-to-live cache in front of any ProductRepository.
 * It stores the promise, so concurrent requests for the same key share one
 * upstream call. Failed calls are not cached. Per-instance only: with several
 * API instances this would move to a shared cache such as Redis.
 */
export class CachingProductRepository implements ProductRepository {
  readonly #inner: ProductRepository;
  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry>();

  constructor(inner: ProductRepository, options: CacheOptions) {
    this.#inner = inner;
    this.#ttlMs = options.ttlMs;
    this.#maxEntries = options.maxEntries ?? 500;
    this.#now = options.now ?? Date.now;
  }

  listAll(): Promise<Product[]> {
    return this.#memo("listAll", () => this.#inner.listAll());
  }

  getById(id: string): Promise<Product | null> {
    return this.#memo(`getById:${id}`, () => this.#inner.getById(id));
  }

  listCategories(): Promise<Category[]> {
    return this.#memo("listCategories", () => this.#inner.listCategories());
  }

  listByCategory(slug: string): Promise<Product[]> {
    return this.#memo(`listByCategory:${slug}`, () => this.#inner.listByCategory(slug));
  }

  search(term: string): Promise<Product[]> {
    return this.#memo(`search:${toSearchTerms(term).join(" ")}`, () => this.#inner.search(term));
  }

  #memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (this.#ttlMs <= 0) return load();

    const now = this.#now();
    const hit = this.#entries.get(key);
    if (hit && hit.expiresAt > now) return hit.value as Promise<T>;
    this.#entries.delete(key);

    const value = load();
    this.#entries.set(key, { expiresAt: now + this.#ttlMs, value });
    value.catch(() => {
      if (this.#entries.get(key)?.value === value) this.#entries.delete(key);
    });

    // Map keeps insertion order, so the first key is the oldest entry.
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
    return value;
  }
}
