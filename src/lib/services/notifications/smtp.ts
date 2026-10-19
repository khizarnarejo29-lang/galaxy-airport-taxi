import "server-only";
import nodemailer from "nodemailer";
import { site } from "@/config/site";
import type { EmailSender } from "./index";

/**
 * Sends email through an SMTP mailbox, e.g. the Hostinger mailbox
 * info@galaxyairporttaxi.co.uk (smtp.hostinger.com, port 465). Server-side only.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  /** Never logged or returned. */
  password: string;
  /** The From address; defaults to the mailbox itself. */
  from: string;
}

type Env = Partial<Record<string, string | undefined>>;

/** Host, user and password, or null when any is missing. The port defaults to 465 (SSL). */
export function smtpConfigFromEnv(env: Env = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;
  return { host, port: Number(env.SMTP_PORT) || 465, user, password, from: env.SMTP_FROM?.trim() || user };
}

export function smtpEmailSender(config: SmtpConfig): EmailSender {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });
  return {
    async send(message) {
      await transport.sendMail({
        from: `"${site.name}" <${config.from}>`,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}
