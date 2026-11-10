import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailMessage, EmailSender } from "../../domain/ports.ts";

export type SmtpOptions = {
  host: string;
  port: number;
  secure: boolean;
  user?: string | undefined;
  pass?: string | undefined;
};

/**
 * Sends email over SMTP. Locally this points at Mailpit; in production it can
 * point at any SMTP service, including Amazon SES's SMTP interface.
 */
export class SmtpEmailSender implements EmailSender {
  readonly #transport: Transporter;

  constructor(options: SmtpOptions) {
    this.#transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.#transport.sendMail({
      from: message.from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
