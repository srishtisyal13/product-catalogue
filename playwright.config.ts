import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: a real browser against the real web app, the real API,
 * the live product source and the Mailpit inbox.
 *
 * - Default: tests http://localhost:5173 and starts Mailpit, the API and the
 *   web dev server if they aren't already running.
 * - Against the Docker stack: E2E_BASE_URL=http://localhost:8080 npm run test:e2e
 *   (nothing is started; run `docker compose up` first).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const startServers = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  // One worker: the tests share one inbox and the enquiry rate limit.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: startServers
    ? [
        {
          command:
            "docker run --rm --name catalogue-e2e-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.33",
          url: "http://localhost:8025",
          reuseExistingServer: true,
          timeout: 120_000,
          // A plain kill would leave the container running; SIGINT is passed on to it.
          gracefulShutdown: { signal: "SIGINT", timeout: 10_000 },
        },
        {
          command: "npm start -w @catalogue/api",
          url: "http://localhost:3000/api/health",
          reuseExistingServer: true,
          timeout: 30_000,
        },
        {
          command: "npm run dev -w @catalogue/web",
          url: "http://localhost:5173",
          reuseExistingServer: true,
          timeout: 30_000,
        },
      ]
    : undefined,
});
