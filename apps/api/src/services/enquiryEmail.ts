import type { EnquiryRequest, Product } from "@catalogue/shared";
import type { EmailMessage } from "../domain/ports.ts";

export type EnquiryEmailInput = {
  enquiry: EnquiryRequest;
  product: Product;
  to: string;
  from: string;
};

/**
 * Builds the email the sales inbox receives. Customer text is HTML-escaped,
 * and line breaks are removed from anything that goes into a header.
 */
export function buildEnquiryEmail({ enquiry, product, to, from }: EnquiryEmailInput): EmailMessage {
  const name = singleLine(enquiry.name);
  const phone = enquiry.phone ? enquiry.phone : "Not provided";
  const price = formatPrice(product);

  const text = [
    `New enquiry about: ${product.title} (ID ${product.id})`,
    `Price shown: ${price}`,
    "",
    `Name:  ${name}`,
    `Email: ${enquiry.email}`,
    `Phone: ${phone}`,
    "",
    "Message:",
    enquiry.message,
    "",
    "Reply to this email to respond to the customer.",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="font-family:sans-serif">
<h2>New enquiry about: ${escapeHtml(product.title)}</h2>
<p>Product ID ${escapeHtml(product.id)} &middot; Price shown: ${escapeHtml(price)}</p>
<table cellpadding="4">
<tr><th align="left">Name</th><td>${escapeHtml(name)}</td></tr>
<tr><th align="left">Email</th><td>${escapeHtml(enquiry.email)}</td></tr>
<tr><th align="left">Phone</th><td>${escapeHtml(phone)}</td></tr>
</table>
<h3>Message</h3>
<p style="white-space:pre-wrap">${escapeHtml(enquiry.message)}</p>
<p><small>Reply to this email to respond to the customer.</small></p>
</body></html>`;

  return {
    to,
    from,
    replyTo: { name, address: enquiry.email },
    subject: singleLine(`New enquiry: ${product.title}`),
    text,
    html,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Removes line breaks so a value can't add extra email headers. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatPrice(product: Product): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.price.currency,
  }).format(product.price.amount);
}
