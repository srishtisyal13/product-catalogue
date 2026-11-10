import { enquiryRequestSchema } from "@catalogue/shared";
import express from "express";
import type { EnquiryService } from "../services/enquiryService.ts";
import { rateLimitPerMinute } from "./middleware.ts";
import { parseOrThrow } from "./validation.ts";

export function enquiryRoutes(enquiries: EnquiryService, limitPerMinute: number): express.Router {
  const router = express.Router();

  router.post(
    "/",
    rateLimitPerMinute(
      limitPerMinute,
      "Too many enquiries from this address. Please wait a minute and try again.",
    ),
    async (req, res) => {
      const enquiry = parseOrThrow(enquiryRequestSchema, req.body);
      await enquiries.submit(enquiry);
      // 202: accepted and handed to the email provider. Nothing is stored yet.
      res.status(202).json({ status: "received" });
    },
  );

  return router;
}
