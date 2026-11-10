import { describe, expect, it, vi } from "vitest";
import { CachingProductRepository } from "../../src/adapters/cache/cachingProductRepository.ts";
import { InMemoryProductRepository } from "../../src/adapters/memory/inMemoryProductRepository.ts";
import { products } from "../fixtures.ts";

function setup(options: { ttlMs?: number; maxEntries?: number } = {}) {
  let now = 0;
  const inner = new InMemoryProductRepository(products);
  const listAll = vi.spyOn(inner, "listAll");
  const search = vi.spyOn(inner, "search");
  const cache = new CachingProductRepository(inner, {
    ttlMs: options.ttlMs ?? 1000,
    maxEntries: options.maxEntries,
    now: () => now,
  });
  return { cache, inner, listAll, search, advance: (ms: number) => (now += ms) };
}

describe("CachingProductRepository", () => {
  it("serves repeat calls from the cache within the TTL", async () => {
    const { cache, listAll, advance } = setup();
    await cache.listAll();
    advance(999);
    await cache.listAll();
    expect(listAll).toHaveBeenCalledTimes(1);
  });

  it("calls the inner repository again after the TTL", async () => {
    const { cache, listAll, advance } = setup();
    await cache.listAll();
    advance(1000);
    await cache.listAll();
    expect(listAll).toHaveBeenCalledTimes(2);
  });

  it("shares one inner call between concurrent requests", async () => {
    const { cache, listAll } = setup();
    await Promise.all([cache.listAll(), cache.listAll(), cache.listAll()]);
    expect(listAll).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    const { cache, listAll } = setup();
    listAll.mockRejectedValueOnce(new Error("upstream down"));
    await expect(cache.listAll()).rejects.toThrow("upstream down");
    expect(await cache.listAll()).toHaveLength(products.length);
    expect(listAll).toHaveBeenCalledTimes(2);
  });

  it("treats search terms that differ only in case and spacing as the same", async () => {
    const { cache, search } = setup();
    await cache.search("Jacket");
    await cache.search("  jacket ");
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("treats terms that differ only by filler words as the same", async () => {
    const { cache, search } = setup();
    await cache.search("the jacket");
    await cache.search("jacket");
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("evicts the oldest entries beyond maxEntries", async () => {
    const { cache, search } = setup({ maxEntries: 2 });
    await cache.search("x");
    await cache.search("y");
    await cache.search("z"); // evicts "x"
    await cache.search("x");
    expect(search).toHaveBeenCalledTimes(4);
  });

  it("does not cache when the TTL is 0", async () => {
    const { cache, listAll } = setup({ ttlMs: 0 });
    await cache.listAll();
    await cache.listAll();
    expect(listAll).toHaveBeenCalledTimes(2);
  });
});
