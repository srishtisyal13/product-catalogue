import type {
  ApiErrorBody,
  Category,
  CategoryPage,
  EnquiryFieldErrors,
  EnquiryFormInput,
  Product,
} from "@catalogue/shared";

/** An error response from our API, with its message ready to show the user. */
export class ApiError extends Error {
  override readonly name = "ApiError";
  readonly status: number;
  readonly code: string;
  readonly fields: EnquiryFieldErrors;

  constructor(status: number, code: string, message: string, fields: EnquiryFieldErrors = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/**
 * The only place in the web app that makes HTTP requests. It only ever talks
 * to our own API (/api), never to the product data source directly.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(`/api${path}`, window.location.origin);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    // A cancelled request (e.g. an outdated search suggestion) isn't a network failure.
    if (init.signal?.aborted) throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "We can't reach the server. Please check your connection.",
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error.code ?? "HTTP_ERROR",
      body?.error.message ?? "Something went wrong. Please try again.",
      (body?.error.fields ?? {}) as EnquiryFieldErrors,
    );
  }
  return (await response.json()) as T;
}

export const api = {
  getFeatured: () => request<Product[]>("/products/featured"),
  getCategories: () => request<Category[]>("/categories"),
  getCategoryPage: (slug: string) =>
    request<CategoryPage>(`/categories/${encodeURIComponent(slug)}`),
  searchProducts: (term: string, signal?: AbortSignal) =>
    request<Product[]>(`/products?${new URLSearchParams({ search: term })}`, { signal }),
  getProduct: (id: string) => request<Product>(`/products/${encodeURIComponent(id)}`),
  submitEnquiry: (enquiry: EnquiryFormInput) =>
    request<{ status: string }>("/enquiries", { method: "POST", body: JSON.stringify(enquiry) }),
};
