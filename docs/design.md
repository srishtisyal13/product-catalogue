# Design: Product Catalogue PoC

Status: plan, no code yet. Companion docs: [milestone.md](milestone.md), [task.md](task.md).

## 1. Problem in one paragraph

An entrepreneur wants a product catalogue that customers can browse and search, with an enquiry form that emails a sales inbox. It is a proof of concept, but it must **not be throwaway**: the product data source, the look and feel, and the email provider are all expected to change. Product data comes from the Fake Store API for now. The client must never call Fake Store directly; all data goes through our backend.

What is assessed is judgement: clear boundaries, recorded assumptions, justified cuts, tests on the critical path, and honest AI usage.

## 2. Stack choice (and why)

| Layer | Choice | Why |
|---|---|---|
| Client | React + TypeScript (Vite) | Preferred option in the brief. Runs with `docker compose up`, so there's no simulator setup for the reviewer. |
| Backend | Node.js + TypeScript (Express) | Preferred option. One language end to end, so request and response types can be shared. Express is widely understood and easy to defend. |
| Validation | zod | One schema gives runtime validation and the TypeScript type. Used on both the client and the server. |
| Client data fetching | TanStack Query | Loading, error and caching states without hand-written boilerplate. |
| Local email | Mailpit (Docker) | A free, local SMTP server with a web inbox. The reviewer can see the "sales inbox" without an account (constraint 6). |
| Tests | Vitest, Supertest, React Testing Library, MSW, Playwright | Fast and TypeScript-native. MSW mocks HTTP at the network layer, so tests don't depend on internal details. Playwright smoke tests run the five acceptance criteria against the real running system. |
| Packaging | Docker Compose | One command to run (constraint 4). Containers map directly to AWS ECS or App Runner (constraint 3). |

## 3. Architecture

```
┌──────────────┐  /api/*  ┌─────────────────────────────────────────────┐
│  React SPA   │ ───────► │ API (Express)                               │
│ (nginx)      │          │  routes ─► services ─► ports (interfaces)   │
└──────────────┘          │                          │                  │
                          │          adapters ◄──────┘                  │
                          │   FakeStoreProductRepository ──► fakestoreapi.com
                          │   CachingProductRepository (decorator)      │
                          │   SmtpEmailSender ──► Mailpit (local) / SES │
                          └─────────────────────────────────────────────┘
```

**The core idea is ports and adapters.** Services depend only on interfaces that we own:

```ts
// apps/api/src/domain/ports.ts
interface ProductRepository {
  listAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  listCategories(): Promise<Category[]>;
  listByCategory(slug: string): Promise<Product[]>;
  search(term: string): Promise<Product[]>;   // pushed down so a real DB/search engine can do it later
}

interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
```

The three things the brief says will change each sit behind a single seam:

| Will change | Seam | Today | Tomorrow |
|---|---|---|---|
| Product data source | `ProductRepository` | `FakeStoreProductRepository` | **Shopify** (Storefront API), Postgres or a headless CMS adapter. Routes and the client don't change. See §8.2. |
| Email provider | `EmailSender` | `SmtpEmailSender` → Mailpit | **Amazon SES**: point the existing SMTP adapter at SES with env vars only, or add an `SesEmailSender` (AWS SDK) wired in `container.ts`. See §8.1. |
| Look and feel | `apps/web/src/theme/tokens.css` (CSS custom properties) + presentational components | Neutral theme | Design agency output goes into the tokens and components. Pages and data hooks stay as they are. |

The wiring lives in **one composition root** (`apps/api/src/container.ts`), which picks adapters from config. That's the only file that knows which concrete classes exist.

### 3.1 Our own domain model

The adapter maps Fake Store's shape into **our** `Product`, so nothing outside the adapter ever sees Fake Store fields:

```ts
type Product = {
  id: string;                 // string, so future sources (UUIDs, SKUs) fit
  title: string;
  description: string;
  price: { amount: number; currency: string };  // "USD" from Fake Store today
  category: { slug: string; name: string };   // "mens-clothing" / "men's clothing"
  imageUrl: string;
  rating: { rate: number; count: number };
};
```

These types live in `packages/shared`, which both apps import. If the API contract changes, the client build breaks, which is what we want.

## 4. Repository layout

```
product-catalogue/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── domain/        # ports.ts, errors.ts, search.ts (matching rule)
│   │   │   ├── services/      # CatalogueService, EnquiryService, enquiry email builder
│   │   │   ├── adapters/      # fakestore/, cache/, email/, memory/ (used by tests)
│   │   │   ├── http/          # app, routes, error handler, validation, rate limit, logging
│   │   │   ├── config.ts      # zod-validated env, fails fast at startup
│   │   │   ├── container.ts   # composition root
│   │   │   ├── logger.ts
│   │   │   └── server.ts      # entry point
│   │   ├── test/              # mirrors src/: domain, services, adapters, http + fixtures
│   │   └── Dockerfile         # runs the TypeScript directly with Node's type stripping
│   └── web/
│       ├── src/
│       │   ├── api/           # typed client: the ONLY place that calls fetch
│       │   ├── pages/         # Home, Category, Search, Product, NotFound (+ their tests)
│       │   ├── components/    # Layout, SearchBar, CategoryNav, ProductGrid, EnquiryForm, ...
│       │   ├── theme/         # tokens.css (the look and feel)
│       │   └── test/          # MSW mock API, render helper, test setup
│       ├── nginx.conf         # serves the build, proxies /api, security headers
│       └── Dockerfile         # Vite build, then nginx (non-root)
├── packages/shared/           # types + zod enquiry schema used by both apps
├── e2e/                       # Playwright smoke tests of the five acceptance criteria
├── docs/                      # design.md, milestone.md, task.md
├── docker-compose.yml         # web, api, mailpit
├── playwright.config.ts
├── eslint.config.js           # includes the architecture rules
├── tsconfig.base.json         # strict settings shared by every package
├── .env.example  .npmrc
├── CLAUDE.md                  # agent instructions (committed, per brief)
├── README.md  DECISIONS.md  AI_USAGE.md
```

npm workspaces, no extra monorepo tooling (YAGNI for a PoC).

**Where tests live:** API tests are in `apps/api/test/`, mirroring `src/`, because they share fixtures across layers. Web and shared tests sit next to the code they test, the usual React convention. Smoke tests are in `e2e/` because they test the whole system, not one package.

## 5. API contract

All responses are JSON. Errors always use the shape `{ "error": { "code": string, "message": string } }`.

| Method | Path | Returns | Used by |
|---|---|---|---|
| GET | `/api/health` | `{ status: "ok" }` | Docker healthcheck |
| GET | `/api/products/featured` | `Product[]` (configured order) | Home page |
| GET | `/api/categories` | `Category[]` | Nav |
| GET | `/api/categories/:slug` | `{ category, topRated: Product[], others: Product[] }` | Category page |
| GET | `/api/products?search=term` | `Product[]` | Search results |
| GET | `/api/products/:id` | `Product` or 404 | Product page |
| POST | `/api/enquiries` | `202 { status: "received" }` | Enquiry form |

Status codes: 400 for validation errors or malformed JSON, 404 for an unknown product or category, 413 for a body over 10 kb, 429 when rate limited, 502 when the upstream (Fake Store) fails or times out, 503 when the enquiry email can't be sent, 500 for anything else (logged, generic message to the client).

## 6. How each acceptance criterion is met

| AC | Design |
|---|---|
| **Home: 5 chosen "top rated" products** | The owner **chooses** them, so it's config, not an algorithm: `FEATURED_PRODUCT_IDS=1,5,9,15,18`. Validated at startup (1–12 IDs, default 5). Returned in configured order. IDs missing upstream are skipped and logged, not a crash. |
| **Category: top rated + additional products** | `topRated` = featured products in that category first, then topped up by highest `rating.rate` until there are `TOP_RATED_PER_CATEGORY` (default 3). `others` = everything else in the category. No product appears twice. |
| **Search: only matching products** | Server side. Every word of the term must match the **start of a word** in the title, description or category name, ignoring case, accents and apostrophes. So "jacket" finds "jackets", "mens" finds "men's", but "men" doesn't find "women's". Filler words ("and", "the", "for", "with" and similar) are ignored, so "and" alone returns nothing instead of 17 of 20 products. Products whose **title** matches are listed before products that only match in their description or category. The term is trimmed, must be 1–100 characters, and is matched as plain text (no regex built from user input, so there's no ReDoS risk). The search button submits a form, so Enter works too. The term lives in the URL (`/search?q=`), so results can be shared and survive a refresh. |
| **Search as you type** (added feature) | From 3 characters, after a 300 ms pause, the search box shows a dropdown of up to 5 matches from the same `GET /api/products?search=` endpoint. Outdated requests are cancelled, and the result shares the browser query cache with the results page. Clicking a suggestion opens that product; **Search**/Enter still uses the box's current text and opens the full results page, so the acceptance criterion is unchanged. Why 300 ms: someone typing steadily leaves roughly 150–300 ms between keys, so a 300 ms gap usually means they've paused rather than being mid-word; requests wait for that pause instead of firing on every key. It's also short enough that suggestions appear within about half a second of stopping (300 ms wait plus a fast, often cached, API call), which still feels immediate. Shorter (100 ms) sends requests mid-word; longer (500 ms or more) starts to feel laggy. 250–300 ms is a common default for autocomplete, and it's one constant (`SUGGEST_DEBOUNCE_MS`) to tune with real usage data. |
| **Product page from a tile** | Every `ProductTile` is a link to `/products/:id`. The page shows the image, title, price, description, category and rating, plus the Enquire button. |
| **Enquiry → sales email + "Thank you"** | The Enquire button reveals a form: name, email, phone (optional), message. It's validated with zod on the client (for user experience) and again on the server (for safety). `EnquiryService` looks up the product **on the server** (we don't trust a client-sent title or price), builds the email, sends it to `SALES_INBOX_EMAIL` with `Reply-To` set to the customer's address, and returns 202. The client replaces the form with a "Thank you" message. |

### 6.1 Assumptions where the acceptance criteria are unclear

| # | Gap in the brief | Assumption | Reasoning |
|---|---|---|---|
| A1 | How does the owner "choose" 5 top-rated products? | An env var listing product IDs | Simplest option that respects "I have chosen". An admin UI is out of scope. |
| A2 | What is "top rated" in a category? | Featured-in-category first, then by star rating, up to 3 | Respects the owner's choice and always fills the section. |
| A3 | What does search match? | Every word of the term matches the start of a word in the title, description or category (case- and accent-insensitive). Filler words are ignored; title matches are listed first | "Text matching" is vague. These are the fields a shopper would expect, and word-start matching avoids "men" returning women's products. |
| A4 | Contact details needed? | Name and email required; phone optional; message required | Email is the minimum for sales to reply. A shorter form gets more submissions. |
| A5 | Where is the sales inbox? | `SALES_INBOX_EMAIL` config; Mailpit locally | Provider is expected to change, and the reviewer needs no account. |
| A6 | Store enquiries? | No, email only | The AC only requires the email. Storing it is a next step (see §10, G4). |
| A7 | One product or several per enquiry? | One, from the product page | The AC starts from "viewing a product". |
| A8 | Web or mobile? | Web | One command to run. No simulator for the reviewer. |
| A9 | Currency | USD, as Fake Store gives it | Product metadata "not important yet". |
| A10 | Pagination | None | About 20 products. A next step (see §10, G2). |

### 6.2 Smoke tests for the five main scenarios (added at the owner's request)

The unit, API and UI tests cover each layer, but the UI tests use a mock API. At my request, Playwright smoke tests were added that run all five acceptance-criteria scenarios against the **real** system: browser → web app → API → live Fake Store data, and for the enquiry, all the way to the Mailpit inbox.

| Scenario (acceptance criterion) | Smoke test in `e2e/catalogue.spec.ts` | What it checks |
|---|---|---|
| 1. Home page shows the 5 chosen products | "shows the 5 chosen top rated products, in order" | The page shows exactly the 5 products the API returns for `/api/products/featured`, in the same order |
| 2. Category page shows top rated + more | "a category link shows top rated and additional products" | Clicking "Electronics" in the nav opens `/categories/electronics`; both sections list exactly what the API returns |
| 3. Search shows only matching products | "clicking Search shows only products matching the term" and "a term with no matches shows the empty state" | Typing "jacket" and clicking Search shows exactly the API's results, and every result contains "jacket"; a nonsense term shows "No products match" |
| 3b. Search as you type (added feature) | "3+ characters show live suggestions; clicking one opens that product" and "the Search button searches for exactly what is in the box" | Two characters call nothing; at 3+ the dropdown lists the API's matches (max 5); clicking one opens that product; Search uses the box's current text |
| 4. Product tile opens the details page | "clicking a product tile opens its details page" and "an unknown product shows a not found message" | The page heading matches the tile's title and the Enquire button is there; an unknown ID shows the not-found message |
| 5. Enquiry emails sales and shows "Thank you" | "submitting the form emails the sales inbox and thanks the customer" | Empty submit shows validation; a valid enquiry shows "Thank you"; **the email is found in Mailpit** with the right subject, recipient, reply-to and message |

Run with `npm run test:e2e` (starts Mailpit, the API and the web app if they aren't running), or `E2E_BASE_URL=http://localhost:8080 npm run test:e2e` against the Docker stack. They're kept out of `npm test` because they need running services and network access.

## 7. Cross-cutting concerns

- **Upstream resilience:** every Fake Store call has a timeout (`AbortSignal.timeout(5000)`). Failures become an `UpstreamError`, which maps to 502. Fake Store returns **200 with an empty body** for an unknown product ID; the adapter maps that to `null`, which becomes a 404. (Confirmed with `curl` against the live API during the build.)
- **Caching:** `CachingProductRepository` wraps any repository (decorator pattern) with an in-memory TTL cache (default 5 minutes). Fake Store has only about 20 products, so `listAll` plus in-memory filtering is fine. The decorator means caching isn't tied to Fake Store, and it can later be swapped for Redis or ElastiCache.
- **Security basics:** `helmet` headers. JSON body limit of 10 kb. zod validation on every input. Rate limits per client IP: 120 requests a minute across `/api`, and 5 a minute on `POST /api/enquiries`. Behind nginx, `TRUST_PROXY_HOPS=1` makes Express read the real client IP from `X-Forwarded-For`, and the API has no published port, so the header can't be spoofed by calling the API directly. nginx adds a strict Content Security Policy and other security headers. A honeypot field on the form against bots. Customer input is HTML-escaped in the email body, and CR/LF characters are stripped from the name to block header injection. No secrets in the repo; only `.env.example` is committed. In Docker, nginx proxies `/api` so the browser sees one origin, which means no CORS needs to be opened.
- **Config:** `config.ts` parses `process.env` with zod at startup. A bad config crashes immediately with a clear message instead of failing later.
- **Logging:** structured JSON logs (pino). Enquiry personal data (email, phone) is **not** logged, only the product ID and an outcome.

## 8. AWS path (not built, but the design allows it)

| Local | AWS |
|---|---|
| `api` container | ECS Fargate or App Runner |
| `web` (nginx + static build) | S3 + CloudFront |
| Mailpit / SMTP | SES (new `SesEmailSender` adapter, or SES SMTP credentials with the existing adapter) |
| in-memory cache | ElastiCache (new decorator implementation) |
| `.env` | SSM Parameter Store or Secrets Manager |

### 8.1 Moving email to Amazon SES

SES is the production mail service. Mailpit is only the local stand-in. Because email goes through the `EmailSender` port, the move doesn't touch `EnquiryService`, the routes or the web app.

**Option A: no code change (SES's SMTP interface).** Change settings only:

| Setting | Value |
|---|---|
| `SMTP_HOST` | `email-smtp.ap-south-1.amazonaws.com` (the SES SMTP endpoint for the chosen region) |
| `SMTP_PORT` / `SMTP_SECURE` | `465` / `true` (TLS from the start) |
| `SMTP_USER` / `SMTP_PASS` | SES SMTP credentials (created from an IAM user), stored in Secrets Manager, never in the repo |
| `ENQUIRY_FROM_EMAIL` | An address on the verified domain, e.g. `enquiries@mail.<brand>.com` |
| `SALES_INBOX_EMAIL` | The real sales inbox |

**Option B: a small new adapter (preferred for production).** An `SesEmailSender` that implements `EmailSender.send()` with the AWS SDK (`@aws-sdk/client-sesv2`, `SendEmailCommand`), swapped in at `container.ts`. On ECS it authenticates with the task's IAM role, so there are **no SMTP passwords to store or rotate**. It also gives SES message IDs and lets us attach a configuration set for tracking.

**Either way, before go-live:**
1. Verify the sending domain in SES and add the DKIM records (Route 53 can do it automatically), plus SPF and DMARC, so mail doesn't land in spam.
2. Request production access. New SES accounts are in a **sandbox** that can only send to verified addresses.
3. Handle bounces and complaints: an SES configuration set publishing to SNS, and alarms in CloudWatch.
4. Give the API's IAM role only `ses:SendEmail` for that identity (least privilege).
5. Pick the region with the rest of the stack (e.g. `ap-south-1` Mumbai).

See also G4, G6 and G7 in §10 (durability, deliverability, customer confirmation).

### 8.2 Moving product data to Shopify

Production decision D1 (§10.2) moves product data to Shopify. Products come from Shopify's **Storefront API** (GraphQL) through a new `ShopifyProductRepository`, wired in `container.ts` in place of the Fake Store adapter. The cache decorator wraps it unchanged.

**Mapping the port to Shopify:**

| `ProductRepository` method | Shopify Storefront API |
|---|---|
| `listAll()` | `products` query, following its cursors page by page |
| `getById(id)` | `product(id:)`; `null` when not found |
| `listCategories()` | Collections (one per category), or the product type field |
| `listByCategory(slug)` | `collection(handle:) { products }` |
| `search(term)` | `search` / `products(query:)`, so Shopify does the matching instead of our in-memory filter |

**Mapping Shopify data to our `Product`** (inside the adapter only):

| Our field | From Shopify | Note |
|---|---|---|
| `id` | Product GID `gid://shopify/Product/123` | Use the numeric part (`123`) or the handle as our ID. The full GID would fail the API's ID check (`^[A-Za-z0-9_-]{1,64}$`) |
| `price` | `priceRange.minVariantPrice { amount, currencyCode }` | Amount is a **string**: parse it. Currency becomes INR or similar, which the `Product` type already allows |
| `category` | Collection or product type | `slugify()` or the collection handle |
| `imageUrl` | `featuredImage.url` | Served from Shopify's CDN; update the CSP `img-src` in `nginx.conf` to `cdn.shopify.com` |
| `rating` | **Not built in** | From a reviews app's metafield, or the "top rated" fill would use another signal (e.g. best sellers) |

**What changes outside the adapter (small, but not zero):**
- **Featured products.** The owner would manage a "Featured" collection in the Shopify admin instead of `FEATURED_PRODUCT_IDS`. `CatalogueService` currently receives the IDs from config, so this needs one small change: a port method such as `listFeatured()`, or the container reading the featured IDs from the collection. Either way the owner edits them without a redeploy.
- **Configuration:** `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN` (a private Storefront access token, server-side only, kept in Secrets Manager) and `FEATURED_COLLECTION_HANDLE`, added to `config.ts` and `.env.example`.
- **Freshness:** Shopify webhooks (`products/update`, `collections/update`) to clear the cache when the owner edits products, instead of waiting for the time limit.

**What doesn't change:** the API routes and response shape, the web app, the enquiry flow (it still looks the product up through the same port), and the service and HTTP tests (only a new adapter test, with an injected `fetch`, is needed). The browser still never calls Shopify; our API remains the only boundary to product data (constraint 2).

## 9. Explicitly out of scope (PoC)

Auth or admin UI for choosing featured products (that's config instead). Persisting enquiries. Pagination. Basket or checkout. i18n. Real design system. Each of these is listed with its reason in DECISIONS.md.

## 10. Production readiness: gaps and design decisions

The PoC is **built in the shape production needs, but it isn't ready for production yet**. The boundaries are in place; this section records how it goes to production. §10.1 lists the gaps, §10.2 the design decisions that close them, §10.3 the detail behind the biggest decisions, and §10.4 the launch order.

### 10.1 Gaps that would make a production launch hard

| # | Area | Problem in the PoC | Why it blocks production | What we'd do | Decision |
|---|---|---|---|---|---|
| G1 | Product data | Fake Store is a public demo API with fake data, unknown uptime and no service agreement. Its images are hosted on its servers. | We can't sell from fake data or depend on a free demo service. | Pick the real source and write one new `ProductRepository` adapter. Serve images from a CDN. | D1, D2 |
| G2 | Catalogue size | Search and category listing load **all** products into memory and filter. No pagination. | Fine for 20 products, breaks at thousands. | Push search and paging into the data source. Add a cursor or page parameter to the API. | D2 |
| G3 | Merchandising | Featured products are an env var, so changing them means a **redeploy**. | The owner can't change the shop window themselves. | Let the owner manage featured lists in the data source or an admin screen. | D5 |
| G4 | Enquiry durability | Enquiries are only emailed, never stored. If SMTP or SES is down, the enquiry is lost after the user sees an error. | Lost leads are lost revenue, and there's no audit trail. | Save the enquiry to the DB first, then send the email from a queue (SQS) with retries (outbox pattern). | D3 |
| G5 | Lead handling | Email to one inbox. No CRM, no assignment, no follow-up tracking. | Sales can't track response times or conversion. | A CRM adapter (HubSpot or Salesforce) behind an `EnquirySink` port. | D3 |
| G6 | Email deliverability | Mailpit locally. No real sending domain. | Without SPF, DKIM and DMARC on a verified domain, mail goes to spam. A new SES account is also sandboxed (can only send to verified addresses) until AWS approves it. | A domain, SES domain verification, a request to leave the SES sandbox, bounce and complaint handling. | D4 |
| G7 | Customer confirmation | The customer only sees "Thank you" on screen. | Customers expect an email receipt, and it builds trust. | A second email template to the customer (this needs G6 first). | D4 |
| G8 | Privacy and legal | We collect name, email, phone and message, but there's no privacy notice, consent, retention policy or deletion process. | Data protection law makes this a legal requirement. | A privacy policy page, consent text on the form, a retention period, a deletion process, and processor terms with the email or CRM provider. | D6 |
| G9 | SEO | A client-rendered single-page app (SPA). Search engine crawlers get a mostly empty HTML page. | If organic search is a sales channel, product pages won't rank. | Server-side rendering (e.g. Next.js), plus sitemap.xml, meta and Open Graph tags, and `Product` structured data. The **biggest possible architecture change**; decide early. | D7 |
| G10 | Scaling and state | The cache and rate limiter are **in memory, per instance**. | With 2+ instances behind a load balancer, the rate limit becomes N× weaker and caches disagree. | Move both to Redis or ElastiCache. Add AWS WAF rate rules in front. | D8 |
| G11 | Spam and abuse | Only an IP rate limit and a honeypot. | Bots will find the form and flood the sales inbox. | Add a CAPTCHA (Cloudflare Turnstile or hCaptcha, both free) and WAF bot rules. | D8 |
| G12 | Infrastructure | No AWS account setup, domain, TLS, infrastructure as code (IaC) or environments. | Nowhere to deploy to. | CDK or Terraform: ECS Fargate or App Runner, CloudFront, ACM certificates, Route 53, separate staging and prod. | D9 |
| G13 | CI/CD | No pipeline. | Manual deploys are risky and slow. | GitHub Actions: lint, test, build, scan, deploy to staging, smoke test, promote to prod. | D9 |
| G14 | Secrets | A `.env` file. | Secrets on disk and in shells leak. | AWS Secrets Manager or SSM Parameter Store, injected at runtime, with least-privilege IAM. | D9 |
| G15 | Observability | JSON logs only. No metrics, alerts, error tracking or uptime checks. | Nobody would notice when enquiries stop sending. | CloudWatch logs and alarms (5xx rate, email failures, upstream 502s), Sentry for front-end and back-end errors, an uptime check. Name an on-call owner. | D10 |
| G16 | Security hardening | Basic headers only. No Content Security Policy (CSP), dependency scanning or penetration test. | A public form is an attack surface. | A strict CSP (allow only the image CDN), Dependabot or `npm audit` in CI, HTTPS only with HSTS, run as non-root, a security review before launch. | D9 |
| G17 | Accessibility | Not audited. | Legal risk and lost customers. | WCAG 2.1 AA: axe checks in CI, keyboard and screen-reader pass, accessible form errors. | D6 |
| G18 | Product content | USD only. No stock or availability. Prices come straight from the source. | A displayed price may be legally binding in some markets, and enquiries about out-of-stock items waste sales time. | Currency and locale config, an availability field, a clear "price on enquiry" policy. | D11 |
| G19 | Analytics | None. | Can't measure the enquiry conversion rate, which is the MVP's key metric. | Privacy-friendly analytics with consent where needed. Track the `enquiry_submitted` event. | D12 |
| G20 | Design | Neutral placeholder theme. | We can't launch without the brand. | The agency's design becomes `tokens.css` and component styles. Agree a hand-off format (Figma tokens). | D13 |
| G21 | Ownership and service levels | No defined owner for the inbox, the uptime, or the time to answer an enquiry. | Who reads the inbox and fixes outages? | Agree service levels and owners before launch. | D10 |

### 10.2 Production design decisions

| # | Area | Decision | Why | Closes |
|---|---|---|---|---|
| D1 | Product data source | Products come from **Shopify** through its Storefront API, via a new `ShopifyProductRepository` (§8.2). | The owner's team manages products in Shopify's admin; there's no product admin for us to build. The adapter boundary limits lock-in. | G1 |
| D2 | Catalogue size and search | Search and paging are done **by Shopify**. Our API exposes its own `cursor` parameter so Shopify details don't reach the client. | Scales well past in-memory filtering; keeps the API contract ours. | G2 |
| D3 | Enquiries | Every enquiry is **saved to Postgres (RDS) first**, then emailed from a queue with retries (outbox pattern). No CRM at launch; one can be added later behind an `EnquirySink` port. | No lead is ever lost, and there's an audit trail. | G4, G5 |
| D4 | Email | **Amazon SES** in `ap-south-1`, sending from a verified subdomain (e.g. `mail.<brand>.com`) with DKIM, SPF and DMARC. The customer also gets a confirmation email. | Mail reaches the inbox instead of spam; a receipt builds trust (§8.1). | G6, G7 |
| D5 | Merchandising | Featured products and category "top rated" lists are **Shopify collections** the owner edits. | No redeploy to change the shop window, and no admin screen to build. | G3 |
| D6 | Market and privacy | Customers are in **India**: the enquiry flow complies with the **DPDP Act 2023** (notice, unticked consent, retention period, deletion, grievance contact). The site targets **WCAG 2.1 AA**. | Legal requirements for collecting personal data, and accessibility for all customers. | G8, G17 |
| D7 | Rendering and SEO | Organic search is a key channel, so the web app moves to **Next.js with server-side rendering** before launch, plus a sitemap and product structured data. It keeps calling our API. | Product pages must rank in Google. The API boundary makes this a front-end-only change. | G9 |
| D8 | Scale and abuse | Start with **2 API instances**; the cache and rate limits move to **ElastiCache (Redis)**; **AWS WAF** rate and bot rules in front; **Cloudflare Turnstile** on the enquiry form. | Sized for low-to-moderate traffic (under about 10,000 visits a day) with campaign spikes. | G10, G11 |
| D9 | Infrastructure, delivery and security | A dedicated **AWS account** in an AWS Organization. Infrastructure as code with **CDK**: ECS Fargate, RDS, CloudFront, Route 53, ACM; separate staging and production. **GitHub Actions** for lint, test, build, scan and deploy. Secrets in **Secrets Manager**. A strict CSP, Dependabot and a security review before launch. AWS Budgets alerts on spend. | Repeatable, reviewable deployments with no secrets on disk. | G12, G13, G14, G16 |
| D10 | Operations | The sales team owns the inbox, with a target reply **within one business day**. A developer is on call in business hours. **CloudWatch** alarms (5xx rate, stuck enquiry emails, upstream failures), **Sentry** for errors, and an uptime check. | Someone notices, and acts, when enquiries stop flowing. | G15, G21 |
| D11 | Product content | **One currency (INR)**. Stock levels aren't shown. Prices are shown as a guide and confirmed by sales in the reply. | Avoids binding-price and out-of-stock problems while the shop is enquiry-led. | G18 |
| D12 | Success metric | The MVP is measured by **enquiry conversion rate**, tracked with privacy-friendly analytics (with consent where needed) and an `enquiry_submitted` event. | One clear number shows whether the catalogue works. | G19 |
| D13 | Visual design | The agency delivers **Figma with design tokens**, mapped into `tokens.css` and the component styles. | The look and feel changes without touching pages or data code. | G20 |

### 10.3 Detail behind the biggest decisions

**D1, D2 and D5: Products, search and merchandising in Shopify.**
- Next adapter: `ShopifyProductRepository`, using Shopify's Storefront API (GraphQL). The routes, the API contract and the client stay the same; the only service change is where featured products come from (see §8.2).
- Our API stays the **only** caller of Shopify. The Storefront token lives in Secrets Manager and never reaches the browser.
- **Featured products (G3) are solved by the platform.** Model them as a "Featured" collection, plus one collection per category for top rated. The owner edits them in the Shopify admin with no redeploy and no admin screen to build. `FEATURED_PRODUCT_IDS` becomes `FEATURED_COLLECTION_HANDLE`.
- **Search and paging (G2) move to the platform:** `search()` maps to Shopify's search query, and pagination uses its cursors. The API exposes our own `cursor` parameter so Shopify's details don't leak to the client.
- Images are served from Shopify's CDN (G1).
- New risks: Storefront API rate limits (the cache decorator helps), platform fees and lock-in (the adapter boundary limits the lock-in), and webhooks to clear the cache when products change.

**D3: Enquiries are stored, then emailed.**
- We still need our own database (Postgres on RDS), but only for enquiries. Products live in Shopify.
- New port `EnquiryRepository`. `EnquiryService` saves the enquiry and an "email pending" row in **one transaction**. A worker (SQS or a polling job) sends it through `EmailSender` and retries with backoff. This is the outbox pattern.
- The API returns 202 as soon as the enquiry is saved, so the "Thank you" is honest: the enquiry can't be lost.
- Needs: database migrations (e.g. Drizzle or Prisma), backups, a retention job (see D6), and an alert when emails are stuck.

**D7: Server-side rendering for SEO.**
- Replace the Vite SPA with **Next.js** (React, App Router), so pages arrive as full HTML. Components and the theme tokens are reused; the pages become server components that call our API.
- Next.js calls **our API**, not Shopify, so the backend stays the one boundary to product data (constraint 2 still holds).
- Add: `sitemap.xml` built from the catalogue, canonical URLs, per-product `<title>` and meta description, Open Graph tags, and `Product` structured data (JSON-LD).
- Hosting: Next.js runs as a container on ECS or App Runner (or AWS Amplify) instead of S3 static hosting, with CloudFront in front.
- The PoC keeps the SPA because the brief asks for a React web app and fast local setup. The clean API boundary makes the move to Next.js a *front-end-only* change.

**D6: Customers are in India, so the Digital Personal Data Protection (DPDP) Act 2023 applies.**
- **Notice and consent:** the enquiry form shows a short notice (what we collect, why, how long we keep it, how to withdraw consent or ask for deletion) and a consent checkbox that **isn't ticked by default**. Store the consent timestamp and notice version with the enquiry.
- **Purpose limitation:** use the data only to respond to the enquiry. Marketing needs separate consent.
- **Retention:** delete enquiries after an agreed period (e.g. 12 months) with a scheduled job.
- **Data principal rights:** a way to request access, correction or deletion (an email address is enough at first). Publish a grievance contact.
- **Security and breach notice:** encryption at rest (RDS, KMS), least-privilege access. A breach has to be reported to the Data Protection Board and to the affected people.
- **Hosting:** use AWS `ap-south-1` (Mumbai) for the API, DB and SES. The DPDP Act doesn't generally require data to stay in India, but local hosting is simpler and faster. Check the processor terms of Shopify and any CRM.
- The DPDP Rules (notified 2025) bring obligations in over a phase-in period. **Confirm current dates and duties with legal counsel.**
- Related: prices in **INR** (D11, G18). The `currency` field is already a string in our `Product` type; only the adapter sets it to `"USD"` today.

### 10.4 Launch plan

1. `ShopifyProductRepository` + collections for featured and top rated + cache-clearing webhooks.
2. Postgres enquiries + outbox + SES in `ap-south-1` on a verified domain.
3. DPDP notice, consent, retention job, and grievance contact on the enquiry form.
4. Move the web app to Next.js with SSR, sitemap and structured data.
5. Infrastructure: CDK, CI/CD, Secrets Manager, CloudWatch alarms, Sentry, Turnstile CAPTCHA, WAF.
