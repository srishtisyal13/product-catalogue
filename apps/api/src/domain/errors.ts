/** A product or category that doesn't exist. Maps to HTTP 404. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}

/** The product data source failed or timed out. Maps to HTTP 502. */
export class UpstreamError extends Error {
  override readonly name = "UpstreamError";
}

/** The email provider couldn't accept the message. Maps to HTTP 503. */
export class EmailDeliveryError extends Error {
  override readonly name = "EmailDeliveryError";
}
