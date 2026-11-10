import type { EnquiryRequest } from "@catalogue/shared";
import { EmailDeliveryError, NotFoundError } from "../domain/errors.ts";
import type { EmailSender, Logger, ProductRepository } from "../domain/ports.ts";
import { buildEnquiryEmail } from "./enquiryEmail.ts";

export type EnquiryServiceOptions = {
  products: ProductRepository;
  emailSender: EmailSender;
  salesInboxEmail: string;
  fromEmail: string;
  logger: Logger;
};

export type EnquiryOutcome = "sent" | "discarded";

/** Turns a validated enquiry into an email to the sales inbox. */
export class EnquiryService {
  readonly #products: ProductRepository;
  readonly #emailSender: EmailSender;
  readonly #salesInboxEmail: string;
  readonly #fromEmail: string;
  readonly #logger: Logger;

  constructor(options: EnquiryServiceOptions) {
    this.#products = options.products;
    this.#emailSender = options.emailSender;
    this.#salesInboxEmail = options.salesInboxEmail;
    this.#fromEmail = options.fromEmail;
    this.#logger = options.logger;
  }

  async submit(enquiry: EnquiryRequest): Promise<EnquiryOutcome> {
    // A filled honeypot means a bot. Report success so it learns nothing.
    if (enquiry.website && enquiry.website.trim() !== "") {
      this.#logger.warn({ event: "enquiry.discarded", reason: "honeypot" }, "Enquiry discarded");
      return "discarded";
    }

    // Look the product up here instead of trusting a title or price from the client.
    const product = await this.#products.getById(enquiry.productId);
    if (!product) throw new NotFoundError(`Product "${enquiry.productId}" not found`);

    const message = buildEnquiryEmail({
      enquiry,
      product,
      to: this.#salesInboxEmail,
      from: this.#fromEmail,
    });

    try {
      await this.#emailSender.send(message);
    } catch (cause) {
      // Log the product only: the customer's name, email and phone stay out of logs.
      this.#logger.error(
        { event: "enquiry.failed", productId: product.id, err: errorMessage(cause) },
        "Enquiry email could not be sent",
      );
      throw new EmailDeliveryError("Enquiry email could not be sent", { cause });
    }

    this.#logger.info({ event: "enquiry.sent", productId: product.id }, "Enquiry email sent");
    return "sent";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
