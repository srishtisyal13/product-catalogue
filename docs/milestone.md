# Milestones: Product Catalogue PoC

Time-box: 2–3 hours of focused work (the brief allows going over if you're honest). Each milestone ends with a **gate**, a concrete check that must pass before moving on. Tasks for each milestone are in [task.md](task.md).

| # | Milestone | Budget | Gate (done when…) |
|---|---|---|---|
| M0 | Plan and scaffold | 25 min | `npm install && npm test && npm run build` pass on an empty skeleton. `CLAUDE.md` is committed. You're on branch `feat/catalogue-poc`. |
| M1 | Backend catalogue | 45 min | Supertest proves every GET endpoint in design §5, including 404 and 502 paths. Fake Store is never hit in tests. |
| M2 | Web browsing | 40 min | Home, Category, Search and Product pages render against the real API. RTL tests cover the home and search ACs. |
| M3 | Enquiry and email | 30 min | Submitting the form puts an email in the Mailpit inbox (http://localhost:8025) and shows "Thank you". Invalid input shows field errors. API tests cover 202, 400, 404 and 429. |
| M4 | Packaging and hardening | 20 min | On a clean clone, `cp .env.example .env && docker compose up --build` works in under 10 minutes. All 5 ACs pass by hand (checklist in task.md T4.4) and in the Playwright smoke tests (`npm run test:e2e`, task.md T4.6, added on request). |
| M5 | Docs and PR | 25 min | README, DECISIONS.md, AI_USAGE.md and time spent are written **and reviewed by you**. The PR is open from `feat/catalogue-poc` into `main` with a full description. |

**Total planned: about 3 h 05 min.** Record actual times as you go (planning, building, testing, reviewing) because the brief asks for them.

## Milestone detail

### M0: Plan and scaffold
Outcome: a repo the AI can work in safely, with the rules written down.
- Monorepo with npm workspaces: `apps/api`, `apps/web`, `packages/shared`.
- TypeScript strict, ESLint and Prettier, Vitest.
- `CLAUDE.md` describes the layer rules ("services never import adapters", "web never calls fetch outside `src/api`", "no secrets") and the definition of done.

### M1: Backend catalogue
Outcome: the backend owns all product data; the Fake Store boundary exists.
- The domain `Product` type and the `ProductRepository` port.
- `FakeStoreProductRepository` with timeout, mapping and the empty-body-to-null fix.
- `CachingProductRepository` decorator.
- `CatalogueService`: featured, category split (topRated / others), search.
- Routes, error middleware, zod-validated config.

**Risk:** Fake Store downtime or its quirks. Mitigation: all tests use an in-memory fake repo, plus one adapter test that mocks `fetch`.

### M2: Web browsing
Outcome: four of the five ACs are clickable.
- Typed API client, React Router routes, TanStack Query hooks.
- Components: `ProductTile`, `ProductGrid`, `SearchBar`, `CategoryNav`.
- Every page has loading, error and empty states.
- Theme tokens in one CSS file.

### M3: Enquiry and email
Outcome: the full critical path works end to end.
- `EmailSender` port, `SmtpEmailSender` (nodemailer), Mailpit in compose.
- `EnquiryService` re-fetches the product on the server and builds an escaped email.
- `POST /api/enquiries`: zod validation, honeypot, rate limit.
- `EnquiryForm`: client validation, submitting state, error message, "Thank you" message.

### M4: Packaging and hardening
Outcome: a reviewer can run it in under 10 minutes.
- Dockerfiles (multi-stage), nginx proxies `/api`, healthchecks.
- `.env.example` with every variable documented.
- helmet, body limit, no personal data in logs.
- Manual AC run-through on a clean clone.

### M5: Docs and PR
Outcome: the submission explains itself.
- README: what it is, stack and why, run, test, configure, URLs (web :8080, Mailpit :8025).
- DECISIONS.md: assumptions, cuts, growth path, next day.
- AI_USAGE.md: tools and models, CLAUDE.md, these docs as the plan, 3–5 key prompts, where the AI was wrong.
- PR description: summary, how to run, AC checklist, decisions, test evidence, time spent.

## If you run out of time, cut in this order
1. Running the smoke tests in CI (they run locally with `npm run test:e2e`).
2. Honeypot (keep the rate limit).
3. Caching decorator (correctness doesn't need it).
4. Polish on loading skeletons.

**Never cut:** the backend-only data boundary, server-side validation, enquiry email, tests on the critical path, DECISIONS.md and AI_USAGE.md.
