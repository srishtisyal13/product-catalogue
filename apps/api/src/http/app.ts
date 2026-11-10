import express from "express";
import helmet from "helmet";
import type { Logger } from "../domain/ports.ts";
import type { CatalogueService } from "../services/catalogueService.ts";
import type { EnquiryService } from "../services/enquiryService.ts";
import { catalogueRoutes } from "./catalogueRoutes.ts";
import { enquiryRoutes } from "./enquiryRoutes.ts";
import { errorHandler, sendError } from "./errorHandler.ts";
import { rateLimitPerMinute, requestLogger } from "./middleware.ts";

export type AppDependencies = {
  catalogue: CatalogueService;
  enquiries: EnquiryService;
  logger: Logger;
  trustProxyHops: number;
  apiRateLimitPerMinute: number;
  enquiryRateLimitPerMinute: number;
};

/** Builds the Express app. Kept separate from server.ts so tests can call it directly. */
export function createApp(deps: AppDependencies): express.Express {
  const app = express();
  app.disable("x-powered-by");
  // Behind nginx, use the client IP from X-Forwarded-For, but only from known proxy hops.
  app.set("trust proxy", deps.trustProxyHops);

  app.use(helmet());
  app.use(requestLogger(deps.logger));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api",
    rateLimitPerMinute(deps.apiRateLimitPerMinute, "Too many requests. Please slow down."),
  );
  app.use(express.json({ limit: "10kb" }));

  app.use("/api", catalogueRoutes(deps.catalogue));
  app.use("/api/enquiries", enquiryRoutes(deps.enquiries, deps.enquiryRateLimitPerMinute));

  app.use((_req, res) => {
    sendError(res, 404, "NOT_FOUND", "No such endpoint");
  });
  app.use(errorHandler(deps.logger));

  return app;
}
