import type { Booking } from "@/lib/domain/types";

export interface PaymentProvider {
  /** Set up payment for a new booking (e.g. create a checkout session). */
  initialise(booking: Omit<Booking, "payment">): Promise<Booking["payment"]>;
}

/** No online payment yet: the booking is recorded as unpaid. */
export const paymentLater: PaymentProvider = {
  async initialise() {
    return { status: "unpaid", method: "To be arranged" };
  },
};
