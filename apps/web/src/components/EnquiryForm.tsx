import {
  ENQUIRY_LIMITS,
  getEnquiryFieldErrors,
  type EnquiryFieldErrors,
  type Product,
} from "@catalogue/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useSubmitEnquiry } from "../api/queries";

type Values = { name: string; email: string; phone: string; message: string; website: string };
const EMPTY: Values = { name: "", email: "", phone: "", message: "", website: "" };

type Props = {
  product: Product;
  onSent: (name: string) => void;
  onCancel: () => void;
};

export function EnquiryForm({ product, onSent, onCancel }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<EnquiryFieldErrors>({});
  const submit = useSubmitEnquiry();

  const update = (field: keyof Values) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { ...values, productId: product.id };

    // Same schema as the API, so people see mistakes before anything is sent.
    const fieldErrors = getEnquiryFieldErrors(input);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    submit.mutate(input, {
      onSuccess: () => onSent(values.name.trim()),
      onError: (error) => {
        if (error instanceof ApiError) setErrors(error.fields);
      },
    });
  }

  const hasFieldErrors = Object.values(errors).some((messages) => messages?.length);
  const serverError = submit.error && !hasFieldErrors ? submit.error : null;

  return (
    <form
      className="enquiry-form"
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="enquiry-heading"
    >
      <h2 id="enquiry-heading">Enquire about this product</h2>
      <p className="hint">We'll pass your details to our sales team, who will reply by email.</p>

      {hasFieldErrors && (
        <p role="alert" className="form-error">
          Please fix the highlighted fields.
        </p>
      )}
      {serverError && (
        <p role="alert" className="form-error">
          {serverError instanceof ApiError
            ? serverError.message
            : "Something went wrong. Please try again."}
        </p>
      )}

      <Field
        id="name"
        label="Name"
        required
        value={values.name}
        onChange={update("name")}
        errors={errors.name}
        maxLength={ENQUIRY_LIMITS.name}
        autoComplete="name"
      />
      <Field
        id="email"
        label="Email"
        type="email"
        required
        value={values.email}
        onChange={update("email")}
        errors={errors.email}
        maxLength={ENQUIRY_LIMITS.email}
        autoComplete="email"
      />
      <Field
        id="phone"
        label="Phone (optional)"
        type="tel"
        value={values.phone}
        onChange={update("phone")}
        errors={errors.phone}
        maxLength={ENQUIRY_LIMITS.phone}
        autoComplete="tel"
      />
      <Field
        id="message"
        label="Message"
        multiline
        required
        value={values.message}
        onChange={update("message")}
        errors={errors.message}
        maxLength={ENQUIRY_LIMITS.message}
      />

      {/* Honeypot: off-screen for people, but bots tend to fill every field. */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => update("website")(event.target.value)}
        />
      </div>

      <div className="enquiry-form__actions">
        <button type="submit" className="button" disabled={submit.isPending}>
          {submit.isPending ? "Sending…" : "Send enquiry"}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[] | undefined;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength: number;
  autoComplete?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  errors,
  type = "text",
  required,
  multiline,
  maxLength,
  autoComplete,
}: FieldProps) {
  const errorId = `${id}-error`;
  const invalid = Boolean(errors?.length);
  const common = {
    id,
    name: id,
    value,
    required,
    maxLength,
    autoComplete,
    "aria-invalid": invalid,
    "aria-describedby": invalid ? errorId : undefined,
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} rows={5} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...common} type={type} onChange={(event) => onChange(event.target.value)} />
      )}
      {invalid && (
        <p id={errorId} className="field__error">
          {errors?.[0]}
        </p>
      )}
    </div>
  );
}
