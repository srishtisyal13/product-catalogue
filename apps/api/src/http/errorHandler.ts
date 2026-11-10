import type { ApiErrorBody } from "@catalogue/shared";
import type { ErrorRequestHandler, Response } from "express";
import { EmailDeliveryError, NotFoundError, UpstreamError } from "../domain/errors.ts";
import type { Logger } from "../domain/ports.ts";
import { RequestValidationError } from "./validation.ts";

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: ApiErrorBody["error"]["fields"],
): void {
  const body: ApiErrorBody = { error: fields ? { code, message, fields } : { code, message } };
  res.status(status).json(body);
}

/**
 * Turns every error into the standard error shape. Internal details are
 * logged, never sent to the client.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof RequestValidationError) {
      sendError(res, 400, "VALIDATION_ERROR", err.message, err.fields);
      return;
    }
    if (err instanceof NotFoundError) {
      sendError(res, 404, "NOT_FOUND", err.message);
      return;
    }
    if (err instanceof UpstreamError) {
      logger.warn(
        { event: "upstream.error", path: req.originalUrl.split("?")[0], err: err.message },
        "Upstream failed",
      );
      sendError(
        res,
        502,
        "UPSTREAM_UNAVAILABLE",
        "Products are temporarily unavailable. Please try again shortly.",
      );
      return;
    }
    if (err instanceof EmailDeliveryError) {
      sendError(
        res,
        503,
        "ENQUIRY_NOT_SENT",
        "We couldn't send your enquiry right now. Please try again in a few minutes.",
      );
      return;
    }

    // Errors from express.json(): malformed JSON or a body over the size limit.
    const bodyParserError = err as { type?: string; status?: number };
    if (bodyParserError.type === "entity.parse.failed") {
      sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON");
      return;
    }
    if (bodyParserError.type === "entity.too.large") {
      sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
      return;
    }
    if (
      typeof bodyParserError.status === "number" &&
      bodyParserError.status >= 400 &&
      bodyParserError.status < 500
    ) {
      sendError(res, bodyParserError.status, "BAD_REQUEST", "Bad request");
      return;
    }

    logger.error(
      { event: "unhandled.error", path: req.originalUrl.split("?")[0], err },
      "Unhandled error",
    );
    sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  };
}
