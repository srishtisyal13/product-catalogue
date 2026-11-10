import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  it("applies safe local defaults", () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(3000);
    expect(config.FEATURED_PRODUCT_IDS).toEqual(["1", "5", "9", "15", "18"]);
    expect(config.SMTP_SECURE).toBe(false);
    expect(config.SALES_INBOX_EMAIL).toBe("sales@example.com");
  });

  it("parses the featured product list and numbers", () => {
    const config = loadConfig({
      FEATURED_PRODUCT_IDS: " 3, 4 ,,7 ",
      TOP_RATED_PER_CATEGORY: "4",
      SMTP_SECURE: "true",
    });
    expect(config.FEATURED_PRODUCT_IDS).toEqual(["3", "4", "7"]);
    expect(config.TOP_RATED_PER_CATEGORY).toBe(4);
    expect(config.SMTP_SECURE).toBe(true);
  });

  it.each([
    ["an invalid email", { SALES_INBOX_EMAIL: "not-an-email" }],
    ["an empty featured list", { FEATURED_PRODUCT_IDS: " , " }],
    ["a non-numeric port", { PORT: "abc" }],
    ["an invalid boolean", { SMTP_SECURE: "yes" }],
  ])("rejects %s with a ConfigError", (_label, env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });
});
