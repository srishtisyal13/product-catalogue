import type { Category, Product } from "@catalogue/shared";

/**
 * Where products come from. Services depend on this interface only, so the
 * data source can change (Fake Store today, a database or e-commerce platform
 * later) without touching services, routes or the web app.
 */
export interface ProductRepository {
  listAll(): Promise<Product[]>;
  /** Resolves to null when the product doesn't exist. */
  getById(id: string): Promise<Product | null>;
  listCategories(): Promise<Category[]>;
  listByCategory(slug: string): Promise<Product[]>;
  /** On the port so a real source can run the search itself. */
  search(term: string): Promise<Product[]>;
}

export type EmailAddress = { name: string; address: string };

export type EmailMessage = {
  to: string;
  from: string;
  replyTo?: EmailAddress;
  subject: string;
  text: string;
  html: string;
};

/** How email is sent. SMTP today; SES or another provider later. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** The small part of a logger the app needs (pino satisfies it). */
export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}
