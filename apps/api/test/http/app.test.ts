import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryProductRepository } from "../../src/adapters/memory/inMemoryProductRepository.ts";
import { UpstreamError } from "../../src/domain/errors.ts";
import type { EmailSender, ProductRepository } from "../../src/domain/ports.ts";
import { createApp } from "../../src/http/app.ts";
import { CatalogueService } from "../../src/services/catalogueService.ts";
import { EnquiryService } from "../../src/services/enquiryService.ts";
import { FailingEmailSender, products, RecordingEmailSender, silentLogger } from "../fixtures.ts";

type Options = {
  repo?: ProductRepository;
  emailSender?: EmailSender;
  enquiryRateLimitPerMinute?: number;
};

function buildApp(options: Options = {}) {
  const repo = options.repo ?? new InMemoryProductRepository(products);
  const emailSender = options.emailSender ?? new RecordingEmailSender();
  const logger = silentLogger();
  const app = createApp({
    catalogue: new CatalogueService({
      products: repo,
      featuredProductIds: ["7", "1", "5", "3", "9"],
      topRatedPerCategory: 2,
      logger,
    }),
    enquiries: new EnquiryService({
      products: repo,
      emailSender,
      salesInboxEmail: "sales@example.com",
      fromEmail: "catalogue@example.com",
      logger,
    }),
    logger,
    trustProxyHops: 0,
    apiRateLimitPerMinute: 1000,
    enquiryRateLimitPerMinute: options.enquiryRateLimitPerMinute ?? 100,
  });
  return { app, emailSender, logger };
}

const validEnquiry = {
  productId: "2",
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "",
  message: "Is this available in large?",
  website: "",
};

describe("catalogue endpoints", () => {
  const { app } = buildApp();

  it("GET /api/health", async () => {
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /api/products/featured returns the chosen products in order", async () => {
    const res = await request(app).get("/api/products/featured").expect(200);
    expect(res.body.map((p: { id: string }) => p.id)).toEqual(["7", "1", "5", "3", "9"]);
  });

  it("GET /api/categories lists categories", async () => {
    const res = await request(app).get("/api/categories").expect(200);
    expect(res.body.map((c: { slug: string }) => c.slug)).toEqual([
      "electronics",
      "jewelery",
      "mens-clothing",
      "womens-clothing",
    ]);
  });

  it("GET /api/categories/:slug returns top rated and other products", async () => {
    const res = await request(app).get("/api/categories/electronics").expect(200);
    expect(res.body.category.slug).toBe("electronics");
    expect(res.body.topRated.map((p: { id: string }) => p.id)).toEqual(["7", "9"]);
    expect(res.body.others.map((p: { id: string }) => p.id)).toEqual(["8"]);
  });

  it.each(["garden", "Bad%20Slug"])("GET /api/categories/%s is a 404", async (slug) => {
    const res = await request(app).get(`/api/categories/${slug}`).expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /api/products?search= returns only matching products", async () => {
    const res = await request(app).get("/api/products").query({ search: "jacket" }).expect(200);
    expect(res.body.map((p: { title: string }) => p.title)).toEqual([
      "Mens Casual Slim Fit Jacket",
      "Womens Rain Jacket",
    ]);
  });

  it("GET /api/products?search=and returns nothing (filler word)", async () => {
    const res = await request(app).get("/api/products").query({ search: "and" }).expect(200);
    expect(res.body).toEqual([]);
  });

  it.each([
    ["missing", {}],
    ["blank", { search: "   " }],
    ["too long", { search: "x".repeat(101) }],
  ])("GET /api/products with a %s search term is a 400", async (_label, query) => {
    const res = await request(app).get("/api/products").query(query).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/products/:id returns the product", async () => {
    const res = await request(app).get("/api/products/2").expect(200);
    expect(res.body.title).toBe("Mens Casual Slim Fit Jacket");
  });

  it.each(["999", "bad%20id"])("GET /api/products/%s is a 404", async (id) => {
    const res = await request(app).get(`/api/products/${id}`).expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("unknown API routes return a JSON 404", async () => {
    const res = await request(app).get("/api/nope").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("sets security headers and hides the framework", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("error handling", () => {
  function repoThatThrows(error: Error): ProductRepository {
    const fail = async () => {
      throw error;
    };
    return {
      listAll: fail,
      getById: fail,
      listCategories: fail,
      listByCategory: fail,
      search: fail,
    };
  }

  it("returns 502 with a safe message when the data source fails", async () => {
    const { app } = buildApp({
      repo: repoThatThrows(new UpstreamError("Fake Store responded with HTTP 500")),
    });
    const res = await request(app).get("/api/products/featured").expect(502);
    expect(res.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(res.body.error.message).not.toContain("Fake Store");
  });

  it("returns 500 without internal details for unexpected errors", async () => {
    const { app, logger } = buildApp({ repo: repoThatThrows(new Error("db password=hunter2")) });
    const res = await request(app).get("/api/categories").expect(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("POST /api/enquiries", () => {
  it("emails the sales inbox and returns 202", async () => {
    const { app, emailSender } = buildApp();
    const res = await request(app).post("/api/enquiries").send(validEnquiry).expect(202);
    expect(res.body).toEqual({ status: "received" });
    const sent = (emailSender as RecordingEmailSender).sent;
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("sales@example.com");
  });

  it("returns 400 with field errors for invalid input", async () => {
    const { app, emailSender } = buildApp();
    const res = await request(app)
      .post("/api/enquiries")
      .send({ ...validEnquiry, email: "nope", name: "" })
      .expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(["email", "name"]));
    expect((emailSender as RecordingEmailSender).sent).toHaveLength(0);
  });

  it("returns 404 for an unknown product", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/api/enquiries")
      .send({ ...validEnquiry, productId: "999" })
      .expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 202 but sends nothing when the honeypot is filled", async () => {
    const { app, emailSender } = buildApp();
    await request(app)
      .post("/api/enquiries")
      .send({ ...validEnquiry, website: "http://spam.example" })
      .expect(202);
    expect((emailSender as RecordingEmailSender).sent).toHaveLength(0);
  });

  it("returns 503 when the email can't be sent", async () => {
    const { app } = buildApp({ emailSender: new FailingEmailSender() });
    const res = await request(app).post("/api/enquiries").send(validEnquiry).expect(503);
    expect(res.body.error.code).toBe("ENQUIRY_NOT_SENT");
  });

  it("returns 400 for malformed JSON", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/api/enquiries")
      .set("Content-Type", "application/json")
      .send('{"name": ')
      .expect(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("returns 413 for a body over 10 kb", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/api/enquiries")
      .send({ ...validEnquiry, message: "x".repeat(11_000) })
      .expect(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns 429 after too many enquiries from one client", async () => {
    const { app } = buildApp({ enquiryRateLimitPerMinute: 2 });
    await request(app).post("/api/enquiries").send(validEnquiry).expect(202);
    await request(app).post("/api/enquiries").send(validEnquiry).expect(202);
    const res = await request(app).post("/api/enquiries").send(validEnquiry).expect(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});
