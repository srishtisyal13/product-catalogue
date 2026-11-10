# Product Catalogue (proof of concept)

A small product catalogue: customers browse the owner's top rated products, explore categories, search, open a product, and send an enquiry that lands in a sales inbox.

It is a proof of concept, but built as a foundation that can grow. The product data source, the look and feel, and the email provider are each behind a single seam, so changing one doesn't mean rewriting the rest.

- **Client:** React + TypeScript (Vite)
- **Backend:** Node.js + TypeScript (Express)
- **Product data:** Fake Store API, called **only** by the backend
- **Search:** live suggestions as you type (from 3 characters), plus a full results page on **Search**
- **Email:** SMTP; locally [Mailpit](https://mailpit.axllent.org/) catches every email in a web inbox, so no account is needed

## Quick start (Docker)

Requires Docker with Compose v2.24 or newer, an internet connection (npm, Docker Hub and the Fake Store API), and free ports 8080, 8025 and 1025. The first build takes about a minute.

```bash
docker compose up --build
```

| What                  | URL                              |
| --------------------- | -------------------------------- |
| Catalogue             | http://localhost:8080            |
| Sales inbox (Mailpit) | http://localhost:8025            |
| API health            | http://localhost:8080/api/health |

No configuration is needed; every setting has a safe default. To change something (for example the featured products), copy the example file and edit it, then restart:

```bash
cp .env.example .env
```

### Try the acceptance criteria

1. **Home page:** http://localhost:8080 shows the 5 products listed in `FEATURED_PRODUCT_IDS`.
2. **Category page:** click a category in the bar under the header. You see a "Top rated" section and a "More in …" section.
3. **Search:** type `jacket` and click **Search**. Only jackets appear. Try `zzz` to see the empty state.
4. **Product page:** click any product tile.
5. **Enquiry:** on a product page, click **Enquire**, fill in the form and send it. You see a "Thank you" message, and the email appears at http://localhost:8025.

## Running without Docker

Requires Node.js 24 or newer.

```bash
npm install
docker compose up -d mailpit   # optional: the local inbox, so enquiries can be sent
npm run dev                    # API on :3000, web app on http://localhost:5173
```

The web dev server proxies `/api` to the API, so the browser still only talks to our backend.

## Tests and checks

```bash
npm test                 # unit, API and web tests (shared, API, web)
npm run check            # typecheck + lint + tests
npm run test:e2e:install # once: download the browser for the smoke tests
npm run test:e2e         # smoke tests of all 5 acceptance criteria against the running system
```

| Layer              | Tools                                                | What the tests prove                                                                                                                             |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared             | Vitest                                               | The enquiry validation rules used by both apps                                                                                                   |
| API services       | Vitest, in-memory repository, recording email sender | Featured order, top rated split, search matching, enquiry email content, HTML escaping, header-injection guard, no personal data in logs         |
| API adapters       | Vitest, injected `fetch`                             | Fake Store mapping, its empty-200 "not found" response, timeouts and bad responses, cache behaviour                                              |
| API HTTP           | Supertest                                            | Every endpoint, status codes, error shape, validation, rate limiting, body size limit                                                            |
| Web                | React Testing Library, MSW                           | Each acceptance criterion from the user's side: featured tiles, category sections, search, product page, enquiry success, validation and failure |
| Smoke (end-to-end) | Playwright, real browser                             | All 5 acceptance criteria against the running web app, API, live Fake Store data and Mailpit, including checking the enquiry email arrived       |

The unit, API and web tests never call the real Fake Store API or send real email. The smoke tests do, on purpose: they check the whole running system.

### Smoke tests (end-to-end)

[e2e/catalogue.spec.ts](e2e/catalogue.spec.ts) has 9 Playwright tests covering all five acceptance criteria and search-as-you-type. Each test uses the app in a real browser and compares what it shows with what the API returns, so the frontend and backend are tested together. The enquiry test also finds the email in Mailpit through its API.

```bash
npm run test:e2e:install                        # once
npm run test:e2e                                # starts Mailpit, the API and the web app if they aren't running
E2E_BASE_URL=http://localhost:8080 npm run test:e2e   # against `docker compose up` instead
```

They aren't part of `npm test` because they need running services and the live Fake Store API.

## Configuration

All settings are environment variables, validated at startup. A bad value stops the API with a clear message. See [.env.example](.env.example) for the full list.

| Variable                        | Default                    | Purpose                                                             |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| `FEATURED_PRODUCT_IDS`          | `1,5,9,15,18`              | The owner's chosen "top rated" products for the home page, in order |
| `TOP_RATED_PER_CATEGORY`        | `3`                        | Size of the "Top rated" section on a category page                  |
| `SALES_INBOX_EMAIL`             | `sales@example.com`        | Where enquiries are sent                                            |
| `ENQUIRY_FROM_EMAIL`            | `catalogue@example.com`    | Sender address for enquiry emails                                   |
| `SMTP_HOST` / `SMTP_PORT`       | `localhost` / `1025`       | Email server (Mailpit locally; Compose sets the host to `mailpit`)  |
| `FAKESTORE_BASE_URL`            | `https://fakestoreapi.com` | Product data source                                                 |
| `CACHE_TTL_SECONDS`             | `300`                      | How long product data is cached in memory                           |
| `ENQUIRY_RATE_LIMIT_PER_MINUTE` | `5`                        | Enquiries allowed per client IP per minute                          |

No secrets are committed. The project's `.npmrc` points at the public npm registry so installs don't depend on a machine's global npm settings.

## How it fits together

```
Browser ──/api──► nginx ──► API (Express) ──► Fake Store API
 (React)                         │
                                 └──► SMTP ──► Mailpit inbox
```

Inside the API, dependencies point one way: `http` → `services` → `domain` (ports), with `adapters` implementing the ports. `container.ts` is the only file that chooses concrete adapters. ESLint enforces two of these rules: only adapters and `container.ts` may import adapters, and only `apps/web/src/api` may call `fetch`.

```
apps/api       Express API: domain, services, adapters, http, tests
apps/web       React app: pages, components, typed API client, theme tokens, tests
e2e            Playwright smoke tests of the five acceptance criteria
packages/shared  Types and the enquiry schema shared by both apps
docs/          Design, milestones and task plan
```

More detail: [docs/design.md](docs/design.md). Decisions and assumptions: [DECISIONS.md](DECISIONS.md). How AI was used: [AI_USAGE.md](AI_USAGE.md).

## Why this stack

- **React web over a native mobile app:** one command to run, nothing to install beyond Docker, and nothing for a reviewer to set up in a simulator.
- **TypeScript on both sides:** the API and web app share the `Product` type and the enquiry schema, so a contract change breaks the build instead of production.
- **Express:** small and widely known. The architecture (ports and adapters) provides the structure; a heavier framework wasn't needed.
- **No API build step:** Node 24 runs TypeScript directly by stripping types, so the API container runs the same files that were tested. `tsc` is used only for type checking.

## Time spent

About **1 hour 40 minutes** in total: about 1 hour 20 minutes of AI-assisted work in one session, from reading the brief to the final checks (timed from file timestamps: started about 08:25, finished about 09:45 IST), plus 15–20 minutes of my own manual testing of the running app. The split is approximate:

| Activity       | Time      | What it covered                                                                                                                                                |
| -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning       | ~15 min   | Reading the brief; design, milestone and task docs; production gaps and decisions                                                                              |
| Building       | ~30 min   | API, web app, shared package, Docker setup, README and decision docs (unit, API and web tests written alongside); later, search-as-you-type and the search fix |
| Testing        | ~20 min   | Live API checks, Docker end-to-end run, page screenshots, Playwright smoke tests, a clean-copy build and smoke run                                             |
| Reviewing      | ~15 min   | Correcting docs against the code (SES, Shopify, decisions), structure review, checking for leaked personal or company details                                  |
| Manual testing | 15–20 min | Clicking through every acceptance criterion in the running app and checking the emails in the Mailpit inbox; this found the "and" search problem               |
