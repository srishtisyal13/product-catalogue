import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import type { Logger } from "../domain/ports.ts";
import { sendError } from "./errorHandler.ts";

/** Fixed one-minute window per client IP. Counts are kept in this process's memory. */
export function rateLimitPerMinute(limit: number, message: string): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED", message),
  });
}

/** Logs method, path, status and duration. Query strings and bodies are never logged. */
export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const start = performance.now();
    res.on("finish", () => {
      logger.info(
        {
          event: "http.request",
          method: req.method,
          // originalUrl keeps the /api prefix that routers strip; the query string is dropped.
          path: req.originalUrl.split("?")[0],
          status: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        },
        "request",
      );
    });
    next();
  };
}
