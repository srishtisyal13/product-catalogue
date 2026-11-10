import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const idList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().max(64))
      .min(1, "List at least one product ID")
      .max(12, "List at most 12 product IDs"),
  );

/**
 * Every setting the API reads from the environment. Parsed once at startup,
 * so a bad value stops the process immediately with a clear message.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Number of reverse proxies in front of the API (nginx in Docker = 1). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  FAKESTORE_BASE_URL: z.url().default("https://fakestoreapi.com"),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5000),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86_400).default(300),

  FEATURED_PRODUCT_IDS: z.string().default("1,5,9,15,18").pipe(idList),
  TOP_RATED_PER_CATEGORY: z.coerce.number().int().min(1).max(12).default(3),

  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: booleanString.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SALES_INBOX_EMAIL: z.email().default("sales@example.com"),
  ENQUIRY_FROM_EMAIL: z.email().default("catalogue@example.com"),

  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  ENQUIRY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(5),
});

export type Config = z.output<typeof envSchema>;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
