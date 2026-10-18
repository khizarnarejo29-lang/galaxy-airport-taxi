/**
 * Card payment for a saved booking: opening the provider's checkout page, and
 * recording the payment once the provider confirms it. The amount always comes
 * from the saved booking.
 */
import type { Booking } from "@/lib/domain/types";
import type { Services } from "@/lib/services";
import type { PaymentNotification } from "@/lib/services/payments";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not_found" | "already_paid" | "unavailable" | "failed" };

export async function startCheckout(
  reference: string,
  services: Pick<Services, "bookings" | "payments">,
  siteUrl: string,
): Promise<CheckoutResult> {
  const { checkout } = services.payments;
  if (!checkout) return { ok: false, reason: "unavailable" };
  try {
    const booking = await services.bookings.findByReference(reference);
    if (!booking) return { ok: false, reason: "not_found" };
    if (booking.payment.status !== "unpaid" || booking.status === "cancelled") return { ok: false, reason: "already_paid" };
    const session = await checkout(booking, siteUrl);
    await services.bookings.update({ ...booking, payment: { ...booking.payment, checkoutSessionId: session.id } });
    return { ok: true, url: session.url };
  } catch (err) {
    console.error(`[booking ${reference}] could not open card checkout`, err instanceof Error ? err.message : err);
    return { ok: false, reason: "failed" };
  }
}

/** Marks the booking paid. A payment that doesn't match the booking's total is still recorded, and flagged. */
export async function recordPayment(
  payment: PaymentNotification,
  services: Pick<Services, "bookings">,
  now: Date = new Date(),
): Promise<"recorded" | "already_recorded" | "not_found"> {
  const booking = await services.bookings.findByReference(payment.reference);
  if (!booking) {
    console.error(`[payment ${payment.sessionId}] no booking ${payment.reference}`);
    return "not_found";
  }
  if (booking.payment.status === "paid") return "already_recorded";
  const matches = payment.amount === booking.total && payment.currency.toLowerCase() === "gbp";
  if (!matches) console.error(`[booking ${booking.reference}] card payment does not match the booking total`);
  const updated: Booking = {
    ...booking,
    payment: { status: "paid", method: "Card (online)", checkoutSessionId: payment.sessionId, paidAt: now.toISOString() },
    reviewFlags: matches ? booking.reviewFlags : [...(booking.reviewFlags ?? []), "PAYMENT_AMOUNT_MISMATCH"],
  };
  await services.bookings.update(updated);
  return "recorded";
}
