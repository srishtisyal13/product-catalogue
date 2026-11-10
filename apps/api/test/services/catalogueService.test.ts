import { describe, expect, it } from "vitest";
import { InMemoryProductRepository } from "../../src/adapters/memory/inMemoryProductRepository.ts";
import { NotFoundError } from "../../src/domain/errors.ts";
import { CatalogueService } from "../../src/services/catalogueService.ts";
import { products, silentLogger } from "../fixtures.ts";

function makeService(featuredProductIds: string[] = ["7", "1", "5"], topRatedPerCategory = 2) {
  const logger = silentLogger();
  const service = new CatalogueService({
    products: new InMemoryProductRepository(products),
    featuredProductIds,
    topRatedPerCategory,
    logger,
  });
  return { service, logger };
}

const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("CatalogueService.getFeatured", () => {
  it("returns the chosen products in the configured order", async () => {
    const { service } = makeService(["7", "1", "5", "3", "9"]);
    expect(ids(await service.getFeatured())).toEqual(["7", "1", "5", "3", "9"]);
  });

  it("skips IDs that no longer exist and logs a warning", async () => {
    const { service, logger } = makeService(["7", "999", "5"]);
    expect(ids(await service.getFeatured())).toEqual(["7", "5"]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ missing: ["999"] }),
      expect.any(String),
    );
  });
});

describe("CatalogueService.getCategoryPage", () => {
  it("puts featured products first, then fills by rating", async () => {
    // Monitor (8) is featured despite the lowest rating; SSD (7) is the best rated of the rest.
    const { service } = makeService(["8"], 2);
    const page = await service.getCategoryPage("electronics");
    expect(page.category).toEqual({ slug: "electronics", name: "electronics" });
    expect(ids(page.topRated)).toEqual(["8", "7"]);
    expect(ids(page.others)).toEqual(["9"]);
  });

  it("fills by rating when nothing in the category is featured", async () => {
    const { service } = makeService([], 2);
    const page = await service.getCategoryPage("mens-clothing");
    expect(ids(page.topRated)).toEqual(["3", "2"]);
    expect(ids(page.others)).toEqual(["1"]);
  });

  it("never lists a product in both sections", async () => {
    const { service } = makeService(["7", "9"], 3);
    const page = await service.getCategoryPage("electronics");
    const all = [...ids(page.topRated), ...ids(page.others)];
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(["7", "8", "9"]);
  });

  it("handles a category with fewer products than the top-rated limit", async () => {
    const { service } = makeService([], 5);
    const page = await service.getCategoryPage("womens-clothing");
    expect(ids(page.topRated)).toEqual(["4"]);
    expect(page.others).toEqual([]);
  });

  it("throws NotFoundError for an unknown category", async () => {
    const { service } = makeService();
    await expect(service.getCategoryPage("garden")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("CatalogueService.search", () => {
  it("returns only products that match the term", async () => {
    const { service } = makeService();
    expect(ids(await service.search("jacket"))).toEqual(["2", "4"]);
    expect(ids(await service.search("mens jacket"))).toEqual(["2"]);
  });

  it("lists title matches before description-only matches", async () => {
    const { service } = makeService();
    // "cotton" is in the T-Shirt's title (3) but only the Jacket's description (2).
    expect(ids(await service.search("cotton"))).toEqual(["3", "2"]);
  });

  it("returns nothing for filler words like 'and'", async () => {
    const { service } = makeService();
    expect(await service.search("and")).toEqual([]);
  });

  it("returns nothing for a term that matches nothing or is blank", async () => {
    const { service } = makeService();
    expect(await service.search("zzz")).toEqual([]);
    expect(await service.search("   ")).toEqual([]);
  });
});

describe("CatalogueService.getProduct", () => {
  it("returns the product", async () => {
    const { service } = makeService();
    expect((await service.getProduct("2")).title).toBe("Mens Casual Slim Fit Jacket");
  });

  it("throws NotFoundError for an unknown product", async () => {
    const { service } = makeService();
    await expect(service.getProduct("999")).rejects.toBeInstanceOf(NotFoundError);
  });
});
