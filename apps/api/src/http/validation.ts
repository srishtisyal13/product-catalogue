import { z } from "zod";

/** Request input failed validation. Maps to HTTP 400 with per-field messages. */
export class RequestValidationError extends Error {
  override readonly name = "RequestValidationError";
  readonly fields: Record<string, string[] | undefined>;

  constructor(message: string, fields: Record<string, string[] | undefined>) {
    super(message);
    this.fields = fields;
  }
}

export function parseOrThrow<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const flattened = z.flattenError(result.error);
  const fields: Record<string, string[] | undefined> = { ...flattened.fieldErrors };
  const message = flattened.formErrors[0] ?? Object.values(fields).flat()[0] ?? "Invalid request";
  throw new RequestValidationError(message, fields);
}
