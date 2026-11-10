import type { Category, Product } from "@catalogue/shared";
import { vi, type Mock } from "vitest";
import type { EmailMessage, EmailSender, Logger } from "../src/domain/ports.ts";

export const categories = {
  mens: { slug: "mens-clothing", name: "men's clothing" },
  womens: { slug: "womens-clothing", name: "women's clothing" },
  jewelery: { slug: "jewelery", name: "jewelery" },
  electronics: { slug: "electronics", name: "electronics" },
} satisfies Record<string, Category>;

export function makeProduct(
  id: string,
  title: string,
  category: Category,
  rate: number,
  description = `${title} description`,
): Product {
  return {
    id,
    title,
    description,
    price: { amount: 10 + Number(id), currency: "USD" },
    category,
    imageUrl: `https://images.example.com/${id}.jpg`,
    rating: { rate, count: 100 },
  };
}

export const products: Product[] = [
  makeProduct("1", "Hiking Backpack", categories.mens, 3.9, "Fits 15 inch laptops"),
  makeProduct("2", "Mens Casual Slim Fit Jacket", categories.mens, 4.1, "Warm cotton jacket"),
  makeProduct("3", "Mens Cotton T-Shirt", categories.mens, 4.7, "Soft everyday tee"),
  makeProduct("4", "Womens Rain Jacket", categories.womens, 3.8, "Waterproof windbreaker"),
  makeProduct("5", "Gold Chain Bracelet", categories.jewelery, 4.6, "Dragon station chain"),
  makeProduct("6", "Silver Ring", categories.jewelery, 3.0, "Classic ring"),
  makeProduct("7", "Portable SSD 1TB", categories.electronics, 4.8, "Fast USB storage"),
  makeProduct("8", "Gaming Monitor", categories.electronics, 2.2, "Curved 27 inch screen"),
  makeProduct("9", "Wireless Mouse", categories.electronics, 4.0, "Ergonomic mouse"),
];

type LogFn = (obj: object, msg?: string) => void;

export function silentLogger(): Logger & {
  info: Mock<LogFn>;
  warn: Mock<LogFn>;
  error: Mock<LogFn>;
} {
  return { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>(), error: vi.fn<LogFn>() };
}

/** Records messages instead of sending them. */
export class RecordingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export class FailingEmailSender implements EmailSender {
  async send(): Promise<void> {
    throw new Error("SMTP connection refused");
  }
}
