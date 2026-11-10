# AI usage

## Tools and models

- **Claude Code** (VS Code extension), model **Claude Opus 5.5** (`claude-opus-5-5`), for planning, writing code, tests and docs, and running checks.

## Agent instruction files

- [CLAUDE.md](CLAUDE.md): commands, architecture rules (for example "the web app never calls the product source", "services depend on ports, not adapters"), conventions and security rules. Two of the rules are also enforced by ESLint, so they don't rely on the agent remembering them.

## Plan and spec

Before any code, the AI turned the brief into three planning docs, which I reviewed:

- [docs/design.md](docs/design.md): architecture, API contract, how each acceptance criterion is met, assumptions, security, and production gaps
- [docs/milestone.md](docs/milestone.md): milestones with a pass/fail gate for each
- [docs/task.md](docs/task.md): a task checklist per milestone

The code was then built milestone by milestone against that plan, running tests at each step.

## Key prompts and moments

1. **"Read this problem statement, create a design, milestones and tasks."** This produced the plan above, including the ports-and-adapters design that keeps the data source, email provider and styling replaceable.
2. **"Tell me the problems that would make a production launch hard."** The AI listed the production gaps and the business decisions each one depends on (product source, enquiry handling, SEO, target market and more). These are recorded as production design decisions D1–D13 in design.md §10.
3. **Pushing back on scope: "this is just a PoC."** I kept the production work as documented next steps and held the build to the brief's critical path.
4. **"Now start writing the code."** Before writing the Fake Store adapter, the AI checked the live API with `curl` and confirmed that an unknown product ID returns HTTP 200 with an empty body, so the adapter handles that case and a test covers it.
5. **"Do the tests include frontend and backend integration tests?" then "start both services and write a test that tests both."** They didn't: the web tests use a mock API. The AI said so plainly, started Mailpit, the API and the web app, and wrote Playwright smoke tests for all five acceptance criteria. All 7 passed against the live system, including finding the enquiry email in Mailpit.

## Where the AI got things wrong, and how it was caught

- **Scope creep in planning.** The first production-readiness write-up went well beyond what a proof of concept needs. Caught on review; the build stayed small and the extra material stayed as documented next steps.
- **Request logs showed the wrong paths.** Express routers strip their mount prefix, so the logger recorded `/products/featured` instead of `/api/products/featured`, and `/` for enquiries. All tests passed; this was only caught by reading the container logs during the Docker end-to-end run. Fixed by logging `originalUrl` without the query string.
- **Tests passed but the types didn't.** The test logger's mock types were wrong. Vitest doesn't type-check, so this only showed up when running `tsc` separately, which is why `npm run check` runs both.
- **A gap in the test plan.** The first suite had no test of the real frontend with the real backend. Caught by my question; fixed with the Playwright smoke tests.
- **Vulnerable dependency.** The initially chosen nodemailer version had known advisories, caught by `npm audit` and fixed by upgrading.
- **Suggestion clicks lost in Safari.** Safari doesn't focus a link when it's clicked, so the search box would lose focus, the dropdown would close, and the click would never land. Caught while writing the search-as-you-type feature; fixed by keeping focus in the box while the dropdown is clicked.
- **Search matched filler words.** Searching "and" returned 17 of the 20 products, because "and" appears in almost every description. All tests passed; I caught it in my own manual testing. Fixed by ignoring filler words and listing title matches before description-only matches, with tests for both.
- **Small UI inconsistency.** The "More in …" heading on category pages was lowercase while the page title was capitalised. Caught by taking headless-browser screenshots of every page.

## How the output was checked

- `npm run check` (typecheck, lint, 115 unit, API and web tests) after each milestone.
- `npm run test:e2e`: 9 Playwright smoke tests of the five acceptance criteria and search-as-you-type, against the running web app, API, live Fake Store data and Mailpit.
- The API run against the real Fake Store API with `curl` checks of every endpoint.
- The full Docker stack (nginx, API, Mailpit) run end to end: an enquiry sent through nginx arrived in Mailpit with the right recipient and reply-to.
- Screenshots of every page in headless Chrome, under the production Content Security Policy.
