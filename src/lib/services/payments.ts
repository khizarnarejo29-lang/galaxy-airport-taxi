import type { Booking } from "@/lib/domain/types";
import type { Pence } from "@/lib/utils/money";

export interface CheckoutSession {
  id: string;
  /** The payment provider's hosted card page. */
  url: string;
}

/** A completed card payment, read from a verified provider notification. */
export interface PaymentNotification {
  reference: string;
  sessionId: string;
  amount: Pence;
  currency: string;
}

export interface PaymentProvider {
  /** Set up payment for a new booking (e.g. create a checkout session). */
  initialise(booking: Omit<Booking, "payment">): Promise<Booking["payment"]>;
  /** Card payment online: a hosted checkout page for the booking's total. Absent when cards aren't taken online. */
  checkout?(booking: Booking, siteUrl: string): Promise<CheckoutSession>;
  /**
   * Checks a provider notification's signature and reads it. Returns the payment when
   * it reports a completed payment, null for any other event. Throws if it isn't genuine.
   */
  readNotification?(body: string, signature: string | null, now?: Date): PaymentNotification | null;
}

/** No online payment yet: the booking is recorded as unpaid. */
export const paymentLater: PaymentProvider = {
  async initialise() {
    return { status: "unpaid", method: "To be arranged" };
  },
};
