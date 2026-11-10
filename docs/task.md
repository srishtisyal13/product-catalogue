# Tasks: Product Catalogue PoC

Tick the boxes as you go. Each task names its **done-check**. IDs (`T1.3`) can be quoted in commit messages and the PR. Design references point to [design.md](design.md).

## M0: Plan and scaffold

- [ ] **T0.1** Create the repo on GitHub with `main` containing only a README stub. Branch `feat/catalogue-poc`. *Done:* PR target exists.
- [x] **T0.2** npm workspaces: `apps/api`, `apps/web` (Vite React TS), `packages/shared`. Root scripts `build`, `test`, `lint`, `dev`. *Done:* `npm test` runs (0 tests OK).
- [x] **T0.3** TypeScript `strict: true` everywhere. ESLint and Prettier. *Done:* `npm run lint` is clean.
- [x] **T0.4** Write `CLAUDE.md`: stack, layer rules, the "no direct Fake Store from web" rule, no secrets, tests required for every service, and how to run checks. *Done:* committed.
- [ ] **T0.5** Commit `docs/design.md`, `docs/milestone.md` and `docs/task.md` to the repo as the plan. *Done:* committed.

## M1: Backend catalogue (design §3, §5, §6, §7)

- [x] **T1.1** `packages/shared`: `Product`, `Category`, and the `CategoryPage` types. `enquiryRequestSchema` (zod): name 1–100, email, phone optional with a max length, message 1–2000, productId, `website` honeypot. *Done:* the types compile in both apps.
- [x] **T1.2** `config.ts`: zod-parse `PORT`, `FAKESTORE_BASE_URL`, `FEATURED_PRODUCT_IDS`, `TOP_RATED_PER_CATEGORY`, `CACHE_TTL_SECONDS`, `SMTP_HOST`, `SMTP_PORT`, `SALES_INBOX_EMAIL`, `ENQUIRY_FROM_EMAIL`. *Done:* a unit test shows a bad value throws.
- [x] **T1.3** `domain/ports.ts` (`ProductRepository`, `EmailSender`) and `domain/errors.ts` (`NotFoundError`, `UpstreamError`, `EmailDeliveryError`). Request validation errors live in `http/validation.ts`.
- [x] **T1.4** `FakeStoreProductRepository`: fetch with a 5 s timeout, map to our `Product` (string id, category slug, `price.amount`), map an empty body or 404 to `null`, map network or 5xx to `UpstreamError`. *Done:* adapter test with mocked `fetch` covers mapping, empty body and timeout.
- [x] **T1.5** `CachingProductRepository` (TTL decorator). *Done:* test shows a second call doesn't hit the inner repo and a call after the TTL does.
- [x] **T1.6** `InMemoryProductRepository` (test fake).
- [x] **T1.7** `CatalogueService`:
  - `getFeatured()`: configured order, skips missing IDs.
  - `getCategoryPage(slug)`: topRated = featured-in-category, then fill by rating to N, with no duplicates. `others` = the rest. Unknown slug throws `NotFoundError`.
  - `search(term)`: trim, case-insensitive, matches title, description and category name.
  - *Done:* unit tests for each rule, including "no duplicates", "fewer than N in category", and "search is case-insensitive and doesn't match unrelated items".
- [x] **T1.8** HTTP: routes from design §5, a validation middleware, and an error middleware mapping errors to 400/404/502/500 with the standard error shape. *Done:* Supertest for each route, plus 404 and 502 cases.
- [x] **T1.9** `container.ts` composition root and `server.ts`. *Done:* `npm run dev -w api` and `curl :3000/api/products/featured` returns 5 products.

## M2: Web browsing (design §6)

- [x] **T2.1** `src/api/client.ts`: typed functions, the only place that calls `fetch`. Base URL is `/api` (Vite dev proxy to :3000).
- [x] **T2.2** Router: `/`, `/categories/:slug`, `/search?q=`, `/products/:id`, plus a 404 page.
- [x] **T2.3** Layout: header with `SearchBar` (a form with a submit button that navigates to `/search?q=`) and `CategoryNav` (from `/api/categories`).
- [x] **T2.4** `ProductTile` (a link to `/products/:id`) and `ProductGrid`.
- [x] **T2.5** Pages: Home (featured), Category (a "Top rated" section and an "More in this category" section), Search (results, "No products match 'x'", and empty-term handling), Product (details and Enquire button).
- [x] **T2.6** Loading, error and empty states on every page.
- [x] **T2.7** `theme/tokens.css`: colours, spacing, radius and font as CSS variables. Components use only the variables.
- [x] **T2.8** RTL and MSW tests: the home page renders 5 tiles. Search submits on button click and shows only the returned products. A tile links to the product page.

## M3: Enquiry and email (design §6, §7)

- [x] **T3.1** `SmtpEmailSender` (nodemailer). Add `mailpit` to compose.
- [x] **T3.2** `EnquiryService.submit(req)`: load the product (unknown product throws `NotFoundError`), escape the HTML, strip CR/LF from the name, set to `SALES_INBOX_EMAIL` with `replyTo` the customer and subject `Enquiry: <product title>`. If the honeypot is filled, return success silently without sending. *Done:* unit tests with a fake `EmailSender` that records messages.
- [x] **T3.3** `POST /api/enquiries`: zod validation, `express-rate-limit` at 5 per minute, returns 202. *Done:* Supertest for 202, 400 (bad email), 404 (bad productId) and 429.
- [x] **T3.4** `EnquiryForm`: hidden until Enquire is clicked. Client-side zod using the same shared schema. Disabled while submitting. Shows the server error message. On success, replaces the form with "Thank you, we'll be in touch about <product>." *Done:* RTL test for success and for a validation error.
- [x] **T3.5** Manual: submit in the browser and see the email in Mailpit at :8025.

## M4: Packaging and hardening

- [x] **T4.1** Dockerfiles: api (production dependencies only, runs the TypeScript directly, as a non-root user) and web (build, then nginx serving static files and proxying `/api` → `api:3000`, with SPA fallback).
- [x] **T4.2** `docker-compose.yml`: web :8080, api (no published port: reached only through nginx), mailpit :8025/:1025, API healthcheck, optional `.env`.
- [x] **T4.3** `.env.example` with every variable, comments, and safe defaults that point to Mailpit.
- [x] **T4.4** Manual AC checklist on a **fresh clone**:
  - [x] Home shows the 5 configured products
  - [x] A category link shows the top-rated section and the more section
  - [x] Search "jacket" shows only jackets; search "zzz" shows the empty state
  - [x] Clicking a tile opens the product page
  - [x] An enquiry shows "Thank you" and the email is in Mailpit
- [x] **T4.5** Check that `.gitignore` covers `.env` and `node_modules`. Grep the repo for secrets.
- [x] **T4.6** (Added at the owner's request.) Playwright smoke tests for all 5 acceptance-criteria scenarios in `e2e/catalogue.spec.ts`, run against the real web app, API, live Fake Store data and Mailpit. Each test compares the page with the API's answer; the enquiry test finds the email in Mailpit. *Done:* `npm run test:e2e` passes (9 tests, including 2 for search-as-you-type).
- [x] **T4.7** (Added feature.) Search as you type: from 3 characters, debounced 300 ms, a dropdown of up to 5 suggestions from the existing search endpoint; Search/Enter unchanged. *Done:* 6 web tests in `components/SearchBar.test.tsx` and 2 smoke tests pass.

## M5: Docs and PR

- [x] **T5.1** README: summary, stack choice and why, quick start (2 commands), URLs, running tests, configuration table, project structure.
- [x] **T5.2** DECISIONS.md: assumptions (from design §6.1), cuts and why, growth path (design §3 and §8), next day.
- [x] **T5.3** AI_USAGE.md: tools and models, CLAUDE.md, the plan (these docs), 3–5 key prompts, where the AI was wrong and how you caught it. **Fill this in from what actually happened; don't invent anything.**
- [x] **T5.4** Time spent: actual totals split by plan, build, test and review.
- [ ] **T5.5** **Review every file yourself**, line by line. You'll be asked about them.
- [ ] **T5.6** Open the PR `feat/catalogue-poc` → `main`. Description: what and why, how to run, AC checklist, key decisions, tests, time, known gaps. Leave it open.
