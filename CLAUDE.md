# Instructions for AI coding agents

Product catalogue proof of concept: React + TypeScript web app, Node + TypeScript (Express) API, shared types package. Read `docs/design.md` before changing behaviour.

## Commands

- `npm install`: install all workspaces
- `npm run dev`: API on :3000 and web on :5173 (needs `docker compose up -d mailpit` for email)
- `npm run check`: typecheck, lint and all tests. **Run this before saying a change is done.**
- `npm run test:e2e`: Playwright smoke tests of the five acceptance criteria against the running system (starts Mailpit, the API and the web app if needed; first run `npm run test:e2e:install`). Run these after changing any user-facing behaviour.
- `docker compose up --build`: full stack on :8080, inbox on :8025

## Architecture rules (do not break)

- The web app never calls Fake Store or any product source. All product data goes through our API.
- In the web app, only `apps/web/src/api/` makes HTTP requests (ESLint enforces this).
- In the API, dependencies point one way: `http` → `services` → `domain`. Services depend on the ports in `domain/ports.ts`, never on adapters.
- Only `adapters/**` and `container.ts` may import adapters (ESLint enforces this). New data sources or email providers are new adapters, wired in `container.ts`.
- Request and response types live in `packages/shared`. Change the contract there, not in each app.
- Every setting comes from environment variables parsed in `apps/api/src/config.ts`. Add new settings there and to `.env.example`.

## Conventions

- TypeScript strict. The API runs on Node's type stripping: use `.ts` extensions in API imports, `import type` for types, and no enums, namespaces or constructor parameter properties.
- Validate all input with zod at the edge. Return errors in the standard shape (`{ error: { code, message } }`) via the error handler; never leak internal messages.
- Never log customer personal data (name, email, phone, message).
- Tests: services with the in-memory repository and fake email sender; adapters with injected `fetch`; HTTP with Supertest; UI with React Testing Library and MSW, querying by role and text. Tests must not call real external services.
- Keep changes small and in scope. Don't add dependencies without a reason.

## Security

- Never commit secrets or a `.env` file. Only `.env.example` is committed.
- Escape customer input in emails and strip line breaks from anything used in an email header.
