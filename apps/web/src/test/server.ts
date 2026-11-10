import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { categories, featured, products } from "./fixtures";

/** Enquiry bodies the mock API received, for assertions. */
export const receivedEnquiries: unknown[] = [];

const notFound = (message: string) =>
  HttpResponse.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });

export const handlers = [
  http.get("*/api/products/featured", () => HttpResponse.json(featured)),

  http.get("*/api/categories", () => HttpResponse.json(categories)),

  http.get("*/api/categories/:slug", ({ params }) => {
    const category = categories.find((c) => c.slug === params.slug);
    if (!category) return notFound("Category not found");
    const inCategory = products.filter((p) => p.category.slug === category.slug);
    return HttpResponse.json({
      category,
      topRated: inCategory.slice(0, 2),
      others: inCategory.slice(2),
    });
  }),

  http.get("*/api/products", ({ request }) => {
    const term = (new URL(request.url).searchParams.get("search") ?? "").toLowerCase();
    return HttpResponse.json(products.filter((p) => p.title.toLowerCase().includes(term)));
  }),

  http.get("*/api/products/:id", ({ params }) => {
    const match = products.find((p) => p.id === params.id);
    return match ? HttpResponse.json(match) : notFound("Product not found");
  }),

  http.post("*/api/enquiries", async ({ request }) => {
    receivedEnquiries.push(await request.json());
    return HttpResponse.json({ status: "received" }, { status: 202 });
  }),
];

export const server = setupServer(...handlers);
