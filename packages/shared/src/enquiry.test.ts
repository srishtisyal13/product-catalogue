import { describe, expect, it } from "vitest";
import { enquiryRequestSchema } from "./enquiry.ts";

const valid = {
  productId: "1",
  name: "  Asha Rao ",
  email: " asha@example.com ",
  phone: "+91 98765 43210",
  message: "Is this available in blue?",
};

describe("enquiryRequestSchema", () => {
  it("accepts a valid enquiry and trims text fields", () => {
    const result = enquiryRequestSchema.parse(valid);
    expect(result.name).toBe("Asha Rao");
    expect(result.email).toBe("asha@example.com");
  });

  it("allows phone to be missing or empty", () => {
    const { phone: _phone, ...withoutPhone } = valid;
    expect(enquiryRequestSchema.safeParse(withoutPhone).success).toBe(true);
    expect(enquiryRequestSchema.safeParse({ ...valid, phone: "" }).success).toBe(true);
  });

  it.each([
    ["name", { name: "   " }],
    ["email", { email: "not-an-email" }],
    ["message", { message: "" }],
    ["phone", { phone: "call me maybe" }],
    ["message", { message: "x".repeat(2001) }],
  ])("rejects an invalid %s", (field, override) => {
    const result = enquiryRequestSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field);
  });
});
