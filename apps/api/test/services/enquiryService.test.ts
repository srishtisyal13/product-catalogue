import type { EnquiryRequest } from "@catalogue/shared";
import { describe, expect, it } from "vitest";
import { InMemoryProductRepository } from "../../src/adapters/memory/inMemoryProductRepository.ts";
import { EmailDeliveryError, NotFoundError } from "../../src/domain/errors.ts";
import type { EmailSender } from "../../src/domain/ports.ts";
import { buildEnquiryEmail } from "../../src/services/enquiryEmail.ts";
import { EnquiryService } from "../../src/services/enquiryService.ts";
import { FailingEmailSender, products, RecordingEmailSender, silentLogger } from "../fixtures.ts";

const enquiry: EnquiryRequest = {
  productId: "2",
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "+91 98765 43210",
  message: "Do you have this in large?",
};

function makeService(emailSender: EmailSender = new RecordingEmailSender()) {
  const logger = silentLogger();
  const service = new EnquiryService({
    products: new InMemoryProductRepository(products),
    emailSender,
    salesInboxEmail: "sales@example.com",
    fromEmail: "catalogue@example.com",
    logger,
  });
  return { service, logger };
}

describe("EnquiryService.submit", () => {
  it("emails the sales inbox with the product and customer details", async () => {
    const sender = new RecordingEmailSender();
    const { service } = makeService(sender);

    expect(await service.submit(enquiry)).toBe("sent");

    expect(sender.sent).toHaveLength(1);
    const [email] = sender.sent;
    expect(email?.to).toBe("sales@example.com");
    expect(email?.from).toBe("catalogue@example.com");
    expect(email?.replyTo).toEqual({ name: "Asha Rao", address: "asha@example.com" });
    expect(email?.subject).toBe("New enquiry: Mens Casual Slim Fit Jacket");
    expect(email?.text).toContain("Do you have this in large?");
    expect(email?.text).toContain("+91 98765 43210");
  });

  it("throws NotFoundError and sends nothing for an unknown product", async () => {
    const sender = new RecordingEmailSender();
    const { service } = makeService(sender);
    await expect(service.submit({ ...enquiry, productId: "999" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(sender.sent).toHaveLength(0);
  });

  it("silently discards an enquiry that filled the honeypot", async () => {
    const sender = new RecordingEmailSender();
    const { service } = makeService(sender);
    expect(await service.submit({ ...enquiry, website: "http://spam.example" })).toBe("discarded");
    expect(sender.sent).toHaveLength(0);
  });

  it("throws EmailDeliveryError when the email can't be sent, without logging personal data", async () => {
    const { service, logger } = makeService(new FailingEmailSender());
    await expect(service.submit(enquiry)).rejects.toBeInstanceOf(EmailDeliveryError);

    const logged = JSON.stringify([
      logger.info.mock.calls,
      logger.warn.mock.calls,
      logger.error.mock.calls,
    ]);
    expect(logger.error).toHaveBeenCalled();
    expect(logged).not.toContain(enquiry.email);
    expect(logged).not.toContain(enquiry.name);
    expect(logged).not.toContain("98765");
  });
});

describe("buildEnquiryEmail", () => {
  const product = products[1]!;

  it("escapes HTML in customer input", () => {
    const email = buildEnquiryEmail({
      enquiry: { ...enquiry, name: "<b>Eve</b>", message: '<script>alert("x")</script>' },
      product,
      to: "sales@example.com",
      from: "catalogue@example.com",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(email.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
  });

  it("removes line breaks from values used in headers", () => {
    const email = buildEnquiryEmail({
      enquiry: { ...enquiry, name: "Eve\r\nBcc: victim@example.com" },
      product,
      to: "sales@example.com",
      from: "catalogue@example.com",
    });
    expect(email.replyTo?.name).toBe("Eve Bcc: victim@example.com");
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it("says when no phone number was given", () => {
    const { phone: _phone, ...withoutPhone } = enquiry;
    const email = buildEnquiryEmail({
      enquiry: withoutPhone,
      product,
      to: "sales@example.com",
      from: "catalogue@example.com",
    });
    expect(email.text).toContain("Phone: Not provided");
  });
});
