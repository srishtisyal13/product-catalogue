import { describe, expect, it } from "vitest";
import {
  matchesSearchTerm,
  searchProducts,
  toSearchTerms,
  toSearchWords,
} from "../../src/domain/search.ts";
import { categories, makeProduct } from "../fixtures.ts";

describe("toSearchWords", () => {
  it("lowercases, drops apostrophes and accents, and splits on punctuation", () => {
    expect(toSearchWords("Men's Café-Bar, 15\"")).toEqual(["mens", "cafe", "bar", "15"]);
  });
});

describe("matchesSearchTerm", () => {
  const jacket = makeProduct("2", "Mens Slim Fit Jacket", categories.mens, 4, "Warm cotton");
  const womens = makeProduct("4", "Rain Jacket", categories.womens, 4, "Waterproof");

  it("is case-insensitive and matches the title, description or category", () => {
    expect(matchesSearchTerm(jacket, "JACKET")).toBe(true);
    expect(matchesSearchTerm(jacket, "cotton")).toBe(true);
    expect(matchesSearchTerm(jacket, "clothing")).toBe(true);
  });

  it("matches the start of words, so 'men' doesn't match 'women'", () => {
    expect(matchesSearchTerm(jacket, "men")).toBe(true);
    expect(matchesSearchTerm(womens, "men")).toBe(false);
    expect(matchesSearchTerm(jacket, "jack")).toBe(true);
    expect(matchesSearchTerm(jacket, "acket")).toBe(false);
  });

  it("requires every word of the term to match", () => {
    expect(matchesSearchTerm(jacket, "mens jacket")).toBe(true);
    expect(matchesSearchTerm(womens, "mens jacket")).toBe(false);
  });

  it("ignores filler words, so 'and' alone matches nothing", () => {
    const withAnd = makeProduct("9", "Rain Coat", categories.womens, 4, "Button and zipper");
    expect(matchesSearchTerm(withAnd, "and")).toBe(false);
    expect(matchesSearchTerm(withAnd, "the and of")).toBe(false);
    expect(matchesSearchTerm(withAnd, "button and zipper")).toBe(true);
  });

  it("never matches an empty or punctuation-only term", () => {
    expect(matchesSearchTerm(jacket, "   ")).toBe(false);
    expect(matchesSearchTerm(jacket, "!!!")).toBe(false);
  });
});

describe("toSearchTerms", () => {
  it("drops filler words but keeps meaningful ones", () => {
    expect(toSearchTerms("The jacket and the hat")).toEqual(["jacket", "hat"]);
    expect(toSearchTerms("and")).toEqual([]);
  });
});

describe("searchProducts", () => {
  const descriptionOnly = makeProduct("1", "Rain Coat", categories.womens, 4, "A light jacket");
  const titleMatch = makeProduct("2", "Denim Jacket", categories.mens, 4, "Classic fit");
  const noMatch = makeProduct("3", "Silver Ring", categories.jewelery, 4, "Shiny");

  it("lists title matches before description-only matches", () => {
    const results = searchProducts([descriptionOnly, noMatch, titleMatch], "jacket");
    expect(results.map((p) => p.id)).toEqual(["2", "1"]);
  });

  it("keeps the original order within each group", () => {
    const otherTitle = makeProduct("4", "Rain Jacket", categories.womens, 4, "Waterproof");
    const results = searchProducts([titleMatch, descriptionOnly, otherTitle], "jacket");
    expect(results.map((p) => p.id)).toEqual(["2", "4", "1"]);
  });

  it("returns nothing for a term made only of filler words", () => {
    expect(searchProducts([descriptionOnly, titleMatch], "and the")).toEqual([]);
  });
});
