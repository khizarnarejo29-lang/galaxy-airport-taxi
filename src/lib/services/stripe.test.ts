import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Booking } from "@/lib/domain/types";
import { choosePayments } from "./index";
import { stripeConfigFromEnv, stripePayments, StripeSignatureError, verifyStripeSignature } from "./stripe";

vi.mock("server-only", () => ({}));

const config = { secretKey: "sk_test_x", webhookSecret: "whsec_test" };
const now = new Date("2026-11-01T12:00:00Z");
const t = Math.floor(now.getTime() / 1000);
const sign = (body: string, at = t, secret = config.webhookSecret) =>
  `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${body}`).digest("hex")}`;

// Test fixture only — a made-up customer.
const booking = {
  reference: "GAT-ABC234",
  total: 6400,
  status: "received",
  customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
  payment: { status: "unpaid", method: "Card (online)" },
  journey: {
    tripType: "one_way",
    pickup: { kind: "address", address: { id: "pc:E1 5NF", kind: "postcode", label: "E1 5NF", postcode: "E1 5NF", lat: 0, lng: 0 } },
    dropoff: { kind: "airport", airport: "LHR" },
    date: "2026-11-20",
    time: "10:30",
  },
} as unknown as Booking;

describe("Stripe configuration", () => {
  it("needs both keys", () => {
    expect(stripeConfigFromEnv({ STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh" })).toEqual({ secretKey: "sk", webhookSecret: "wh" });
    expect(stripeConfigFromEnv({ STRIPE_SECRET_KEY: "sk" })).toBeNull();
    expect(stripeConfigFromEnv({})).toBeNull();
  });

  it("takes cards online only when bookings can be saved", () => {
    const env = { STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh" };
    expect(choosePayments({ kind: "supabase" }, env).checkout).toBeTypeOf("function");
    expect(choosePayments({ kind: "unavailable" }, env).checkout).toBeUndefined();
    expect(choosePayments({ kind: "supabase" }, {}).checkout).toBeUndefined();
  });
});

describe("Stripe checkout", () => {
  it("charges the saved booking total in pounds and returns to the booking page", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
    const session = await stripePayments(config, fetchImpl as unknown as typeof fetch).checkout!(booking, "https://galaxyairporttaxi.co.uk/");
    expect(session).toEqual({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_x");
    const form = init.body as URLSearchParams;
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("6400");
    expect(form.get("line_items[0][price_data][currency]")).toBe("gbp");
    expect(form.get("client_reference_id")).toBe("GAT-ABC234");
    expect(form.get("customer_email")).toBe("sam@example.com");
    expect(form.get("success_url")).toBe("https://galaxyairporttaxi.co.uk/booking/GAT-ABC234?payment=success");
    expect(form.get("cancel_url")).toBe("https://galaxyairporttaxi.co.uk/booking/GAT-ABC234?payment=cancelled");
  });

  it("fails when Stripe refuses", async () => {
    const fetchImpl = async () => new Response("{}", { status: 401 });
    await expect(stripePayments(config, fetchImpl as typeof fetch).checkout!(booking, "https://x.test")).rejects.toThrow("401");
  });
});

describe("Stripe notifications", () => {
  const paid = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_1", client_reference_id: "GAT-ABC234", payment_status: "paid", amount_total: 6400, currency: "gbp" } },
  });
  const read = (body: string, sig: string | null) => stripePayments(config).readNotification!(body, sig, now);

  it("reads a genuine completed payment", () => {
    expect(read(paid, sign(paid))).toEqual({ reference: "GAT-ABC234", sessionId: "cs_test_1", amount: 6400, currency: "gbp" });
  });

  it("refuses a missing, wrong, tampered or stale signature", () => {
    expect(() => read(paid, null)).toThrow(StripeSignatureError);
    expect(() => read(paid, sign(paid, t, "whsec_other"))).toThrow(StripeSignatureError);
    expect(() => read(paid.replace("6400", "1"), sign(paid))).toThrow(StripeSignatureError);
    expect(() => read(paid, sign(paid, t - 301))).toThrow(StripeSignatureError);
    expect(verifyStripeSignature(paid, `t=${t},v1=nothex,v1=${sign(paid).split("v1=")[1]}`, config.webhookSecret, now)).toBe(true);
  });

  it("ignores other events and unpaid sessions", () => {
    const other = JSON.stringify({ type: "customer.created", data: { object: {} } });
    expect(read(other, sign(other))).toBeNull();
    const unpaid = paid.replace('"paid"', '"unpaid"');
    expect(read(unpaid, sign(unpaid))).toBeNull();
  });
});
