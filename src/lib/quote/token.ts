/**
 * Signed quote tokens: the server signs the quote it priced so a booking can
 * prove which journey, distance and prices it was quoted — without storing
 * quotes, and without trusting anything the browser sends back.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Quote } from "@/lib/domain/types";

const DEV_SECRET = "dev-only-quote-secret-do-not-use-in-production";

function secret(): string {
  const value = process.env.QUOTE_SIGNING_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("QUOTE_SIGNING_SECRET must be set (32+ characters) in production.");
  }
  return DEV_SECRET;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function signQuote(quote: Quote): string {
  const payload = Buffer.from(JSON.stringify(quote)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The quote if the signature is genuine, otherwise null. Expiry is checked by the caller. */
export function verifyQuote(token: string): Quote | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Quote;
  } catch {
    return null;
  }
}
