import { z } from "zod";

export const ENQUIRY_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  message: 2000,
} as const;

/**
 * One schema for the enquiry form, used by the web app (instant feedback) and
 * the API (the check that actually protects us). Keeping it shared means the
 * two can't drift apart.
 */
export const enquiryRequestSchema = z.object({
  productId: z.string().trim().min(1, "Product is required").max(64),
  name: z
    .string()
    .trim()
    .min(1, "Please enter your name")
    .max(ENQUIRY_LIMITS.name, `Name must be ${ENQUIRY_LIMITS.name} characters or fewer`),
  email: z
    .string()
    .trim()
    .max(ENQUIRY_LIMITS.email, "Email address is too long")
    .pipe(z.email("Please enter a valid email address")),
  phone: z
    .string()
    .trim()
    .max(ENQUIRY_LIMITS.phone, `Phone must be ${ENQUIRY_LIMITS.phone} characters or fewer`)
    .regex(/^[0-9+()\-.\s]*$/, "Phone can only contain digits, spaces and + ( ) - .")
    .optional(),
  message: z
    .string()
    .trim()
    .min(1, "Please enter a message")
    .max(ENQUIRY_LIMITS.message, `Message must be ${ENQUIRY_LIMITS.message} characters or fewer`),
  /** Honeypot: hidden from people, so only bots fill it in. */
  website: z.string().max(200).optional(),
});

/** What the form collects (before trimming). */
export type EnquiryFormInput = z.input<typeof enquiryRequestSchema>;
/** What the API works with (after trimming and validation). */
export type EnquiryRequest = z.output<typeof enquiryRequestSchema>;

export type EnquiryFieldErrors = Partial<Record<keyof EnquiryFormInput, string[]>>;

/** Field-by-field error messages, or null when the input is valid. */
export function getEnquiryFieldErrors(input: unknown): EnquiryFieldErrors | null {
  const result = enquiryRequestSchema.safeParse(input);
  return result.success ? null : z.flattenError(result.error).fieldErrors;
}
