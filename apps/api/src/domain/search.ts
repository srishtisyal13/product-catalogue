import type { Product } from "@catalogue/shared";

/**
 * Common filler words ignored in search terms. They appear in almost every
 * product description ("and" is in 17 of Fake Store's 20), so matching on
 * them would return nearly everything.
 */
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is",
  "it", "its", "of", "on", "or", "our", "that", "the", "this", "to", "with", "you", "your",
]); // prettier-ignore

/**
 * Splits text into lowercase words without accents or apostrophes, so
 * "Men's Café" becomes ["mens", "cafe"].
 */
export function toSearchWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The words of a search term that are worth matching: filler words removed. */
export function toSearchTerms(term: string): string[] {
  return toSearchWords(term).filter((word) => !STOP_WORDS.has(word));
}

function allMatch(termWords: string[], text: string): boolean {
  const words = toSearchWords(text);
  return termWords.every((termWord) => words.some((word) => word.startsWith(termWord)));
}

/**
 * A product matches when every meaningful word of the search term is the
 * start of a word in its title, description or category name. Word-prefix
 * matching means "jacket" finds "jackets" but "men" doesn't find "women".
 * Filler words ("and", "the", …) are ignored; a term made only of them matches nothing.
 */
export function matchesSearchTerm(product: Product, term: string): boolean {
  const termWords = toSearchTerms(term);
  if (termWords.length === 0) return false;
  return allMatch(termWords, `${product.title} ${product.description} ${product.category.name}`);
}

/**
 * Filters products to those matching the term, with title matches first:
 * products whose title contains every term word come before products that
 * only match through their description or category. Order is otherwise kept.
 */
export function searchProducts(products: Product[], term: string): Product[] {
  const termWords = toSearchTerms(term);
  if (termWords.length === 0) return [];

  const titleMatches: Product[] = [];
  const otherMatches: Product[] = [];
  for (const product of products) {
    if (allMatch(termWords, product.title)) titleMatches.push(product);
    else if (matchesSearchTerm(product, term)) otherMatches.push(product);
  }
  return [...titleMatches, ...otherMatches];
}
