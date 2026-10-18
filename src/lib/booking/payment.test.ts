import { describe, expect, it, vi } from "vitest";
import type { Booking } from "@/lib/domain/types";
import { memoryBookingRepository } from "@/lib/services/bookings";
import type { PaymentProvider } from "@/lib/services/payments";
import { recordPayment, startCheckout } from "./payment";

// Test fixture only — a made-up customer.
const base = {
  reference: "GAT-PAY234",
  total: 6400,
  status: "received",
  customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
  payment: { status: "unpaid", method: "Card (online)" },
} as unknown as Booking;

async function setup(booking: Booking = base) {
  (globalThis as { __gatBookings?: unknown }).__gatBookings = undefined;
  const bookings = memoryBookingRepository();
  await bookings.create(booking);
  const checkout = vi.fn(async () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }));
  const payments: PaymentProvider = { initialise: async () => booking.payment, checkout };
  return { bookings, payments, checkout };
}

describe("startCheckout", () => {
  it("opens a checkout for the saved booking and remembers the session", async () => {
    const s = await setup();
    expect(await startCheckout("gat-pay234", s, "https://site.test")).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(s.checkout.mock.calls[0]).toEqual([expect.objectContaining({ total: 6400 }), "https://site.test"]);
    expect((await s.bookings.findByReference("GAT-PAY234"))?.payment.checkoutSessionId).toBe("cs_1");
  });

  it("refuses a paid, cancelled or unknown booking, or no card payments", async () => {
    const paid = await setup({ ...base, payment: { status: "paid", method: "Card (online)" } });
    expect(await startCheckout(base.reference, paid, "https://site.test")).toEqual({ ok: false, reason: "already_paid" });
    const cancelled = await setup({ ...base, status: "cancelled" });
    expect(await startCheckout(base.reference, cancelled, "https://site.test")).toEqual({ ok: false, reason: "already_paid" });
    const s = await setup();
    expect(await startCheckout("GAT-NONE22", s, "https://site.test")).toEqual({ ok: false, reason: "not_found" });
    expect(await startCheckout(base.reference, { ...s, payments: { initialise: s.payments.initialise } }, "x")).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("reports a failure without throwing", async () => {
    const s = await setup();
    s.checkout.mockRejectedValueOnce(new Error("Stripe request failed (500)"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await startCheckout(base.reference, s, "https://site.test")).toEqual({ ok: false, reason: "failed" });
  });
});

describe("recordPayment", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const payment = { reference: "GAT-PAY234", sessionId: "cs_1", amount: 6400, currency: "gbp" };

  it("marks the booking paid, once", async () => {
    const s = await setup();
    expect(await recordPayment(payment, s, now)).toBe("recorded");
    expect((await s.bookings.findByReference(base.reference))?.payment).toEqual({
      status: "paid",
      method: "Card (online)",
      checkoutSessionId: "cs_1",
      paidAt: now.toISOString(),
    });
    expect(await recordPayment(payment, s, now)).toBe("already_recorded");
  });

  it("records a payment that doesn't match the total, flagged for the operator", async () => {
    const s = await setup();
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    await recordPayment({ ...payment, amount: 100 }, s, now);
    const saved = await s.bookings.findByReference(base.reference);
    expect(saved?.payment.status).toBe("paid");
    expect(saved?.reviewFlags).toEqual(["PAYMENT_AMOUNT_MISMATCH"]);
  });

  it("ignores a payment for an unknown booking", async () => {
    const s = await setup();
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await recordPayment({ ...payment, reference: "GAT-NONE22" }, s, now)).toBe("not_found");
  });
});
