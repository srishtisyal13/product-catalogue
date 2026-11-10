import { describe, expect, it, vi } from "vitest";
import {
  FakeStoreProductRepository,
  slugify,
} from "../../src/adapters/fakestore/fakeStoreProductRepository.ts";
import { UpstreamError } from "../../src/domain/errors.ts";

const backpack = {
  id: 1,
  title: "Fjallraven - Foldsack No. 1 Backpack",
  price: 109.95,
  description: "Your perfect pack for everyday use",
  category: "men's clothing",
  image: "https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg",
  rating: { rate: 3.9, count: 120 },
};
const ring = { ...backpack, id: 5, title: "Silver Ring", category: "jewelery" };

function repoWith(fetchFn: typeof fetch, timeoutMs = 1000) {
  return new FakeStoreProductRepository({
    baseUrl: "https://fakestore.test/",
    timeoutMs,
    fetchFn,
  });
}

function respondWith(body: string, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(body, { status }));
}

describe("FakeStoreProductRepository", () => {
  it("maps Fake Store products to our Product model", async () => {
    const fetchFn = respondWith(JSON.stringify([backpack]));
    const [product] = await repoWith(fetchFn).listAll();

    expect(fetchFn).toHaveBeenCalledWith("https://fakestore.test/products", expect.anything());
    expect(product).toEqual({
      id: "1",
      title: backpack.title,
      description: backpack.description,
      price: { amount: 109.95, currency: "USD" },
      category: { slug: "mens-clothing", name: "men's clothing" },
      imageUrl: backpack.image,
      rating: { rate: 3.9, count: 120 },
    });
  });

  it("derives sorted, unique categories and filters by category slug", async () => {
    const repo = repoWith(respondWith(JSON.stringify([ring, backpack, { ...ring, id: 6 }])));
    expect(await repo.listCategories()).toEqual([
      { slug: "jewelery", name: "jewelery" },
      { slug: "mens-clothing", name: "men's clothing" },
    ]);
    expect((await repo.listByCategory("jewelery")).map((p) => p.id)).toEqual(["5", "6"]);
  });

  it("searches across the product list", async () => {
    const repo = repoWith(respondWith(JSON.stringify([backpack, ring])));
    expect((await repo.search("ring")).map((p) => p.id)).toEqual(["5"]);
  });

  describe("getById", () => {
    it("returns the product", async () => {
      const fetchFn = respondWith(JSON.stringify(backpack));
      expect((await repoWith(fetchFn).getById("1"))?.id).toBe("1");
      expect(fetchFn).toHaveBeenCalledWith("https://fakestore.test/products/1", expect.anything());
    });

    it("returns null for Fake Store's empty 200 response to an unknown ID", async () => {
      expect(await repoWith(respondWith("", 200)).getById("999")).toBeNull();
    });

    it("returns null for a 404", async () => {
      expect(await repoWith(respondWith("Not found", 404)).getById("999")).toBeNull();
    });

    it("returns null for a non-numeric ID without calling Fake Store", async () => {
      const fetchFn = respondWith("{}");
      expect(await repoWith(fetchFn).getById("../users")).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("upstream failures become UpstreamError", () => {
    it.each([
      ["a 5xx response", respondWith("oops", 503)],
      ["invalid JSON", respondWith("<html>")],
      ["an unexpected shape", respondWith(JSON.stringify([{ id: "x" }]))],
      ["an empty list body", respondWith("")],
      [
        "a network error",
        vi.fn<typeof fetch>(async () => {
          throw new TypeError("fetch failed");
        }),
      ],
    ])("%s", async (_label, fetchFn) => {
      await expect(repoWith(fetchFn).listAll()).rejects.toBeInstanceOf(UpstreamError);
    });

    it("a request that exceeds the timeout", async () => {
      const hangsUntilAborted = vi.fn<typeof fetch>(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      );
      await expect(repoWith(hangsUntilAborted, 20).listAll()).rejects.toBeInstanceOf(UpstreamError);
    });
  });
});

describe("slugify", () => {
  it.each([
    ["men's clothing", "mens-clothing"],
    ["women's clothing", "womens-clothing"],
    ["electronics", "electronics"],
    ["  Home & Garden ", "home-garden"],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
