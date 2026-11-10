import { ConfigError, loadConfig, type Config } from "./config.ts";
import { buildServices } from "./container.ts";
import { createApp } from "./http/app.ts";
import { createLogger } from "./logger.ts";

let config: Config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
}

const logger = createLogger(config.LOG_LEVEL);
const { catalogue, enquiries } = buildServices(config, logger);

const app = createApp({
  catalogue,
  enquiries,
  logger,
  trustProxyHops: config.TRUST_PROXY_HOPS,
  apiRateLimitPerMinute: config.API_RATE_LIMIT_PER_MINUTE,
  enquiryRateLimitPerMinute: config.ENQUIRY_RATE_LIMIT_PER_MINUTE,
});

const server = app.listen(config.PORT, () => {
  logger.info({ event: "server.started", port: config.PORT }, "API listening");
});

server.on("error", (error) => {
  logger.error({ event: "server.error", err: error.message }, "Server failed to start");
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ event: "server.stopping", signal }, "Shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
