/**
 * The catalogue's own product model. Every data source is mapped into this
 * shape by its adapter, so nothing outside the adapter knows where products
 * come from.
 */
export type Category = {
  /** URL-safe identifier, e.g. "mens-clothing". */
  slug: string;
  /** Display name, e.g. "men's clothing". */
  name: string;
};

export type Product = {
  /** String so future sources (SKUs, UUIDs) fit without a contract change. */
  id: string;
  title: string;
  description: string;
  price: { amount: number; currency: string };
  category: Category;
  imageUrl: string;
  rating: { rate: number; count: number };
};

export type CategoryPage = {
  category: Category;
  topRated: Product[];
  others: Product[];
};

/** Shape of every error response from the API. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[] | undefined>;
  };
};
