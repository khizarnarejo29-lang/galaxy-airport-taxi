/**
 * Card payments through Stripe Checkout: the customer pays on Stripe's own
 * page, so card details never reach this website. Talks to Stripe's REST API
 * directly; no SDK. Server-side only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Booking } from "@/lib/domain/types";
import type { CheckoutSession, PaymentNotification, PaymentProvider } from "./payments";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
}

/** Both keys, or nothing: half a configuration would take money it can't confirm. */
export function stripeConfigFromEnv(env: Partial<Record<string, string | undefined>> = process.env): StripeConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  return secretKey && webhookSecret ? { secretKey, webhookSecret } : null;
}

/** Notifications older than this are refused, so a captured one can't be replayed later. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

export class StripeSignatureError extends Error {
  constructor() {
    super("Stripe notification signature is not valid");
    this.name = "StripeSignatureError";
  }
}

export class StripeRequestError extends Error {
  constructor(readonly status: number) {
    super(`Stripe request failed (${status})`);
    this.name = "StripeRequestError";
  }
}

/** Checks a `Stripe-Signature` header (t=…,v1=…) against the raw body. */
export function verifyStripeSignature(body: string, header: string | null, secret: string, now: Date = new Date()): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now.getTime() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"));
  return signatures.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const describeJourney = (b: Booking) => {
  const end = (e: Booking["journey"]["pickup"]) => (e.kind === "airport" ? e.airport : e.address.postcode ?? e.address.label);
  const trip = b.journey.tripType === "return" ? "Return" : "One way";
  return `${trip}: ${end(b.journey.pickup)} to ${end(b.journey.dropoff)}, ${b.journey.date} ${b.journey.time}`;
};

export function stripePayments(config: StripeConfig, fetchImpl: typeof fetch = fetch): PaymentProvider {
  return {
    async initialise() {
      return { status: "unpaid", method: "Card (online)" };
    },

    async checkout(booking, siteUrl): Promise<CheckoutSession> {
      const page = `${siteUrl.replace(/\/$/, "")}/booking/${booking.reference}`;
      const form = new URLSearchParams({
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "gbp",
        // The booking's own total, as saved by the server: never a figure from the browser.
        "line_items[0][price_data][unit_amount]": String(booking.total),
        "line_items[0][price_data][product_data][name]": `Airport transfer ${booking.reference}`,
        "line_items[0][price_data][product_data][description]": describeJourney(booking),
        customer_email: booking.customer.email,
        client_reference_id: booking.reference,
        "metadata[reference]": booking.reference,
        "payment_intent_data[metadata][reference]": booking.reference,
        success_url: `${page}?payment=success`,
        cancel_url: `${page}?payment=cancelled`,
      });
      const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      if (!res.ok) throw new StripeRequestError(res.status);
      const session = (await res.json()) as { id?: string; url?: string };
      if (!session.id || !session.url) throw new StripeRequestError(res.status);
      return { id: session.id, url: session.url };
    },

    readNotification(body, signature, now): PaymentNotification | null {
      if (!verifyStripeSignature(body, signature, config.webhookSecret, now)) throw new StripeSignatureError();
      const event = JSON.parse(body) as {
        type?: string;
        data?: { object?: { id?: string; client_reference_id?: string; payment_status?: string; amount_total?: number; currency?: string } };
      };
      const paidEvent = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
      const session = event.data?.object;
      if (!paidEvent || session?.payment_status !== "paid" || !session.client_reference_id || !session.id) return null;
      return {
        reference: session.client_reference_id,
        sessionId: session.id,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "",
      };
    },
  };
}
