import { site } from "@/config/site";

/**
 * Customer policies. Each one stays hidden (pages and FAQs skip it) until it is
 * written here, so the site never states a policy the business hasn't set.
 */
export const policies: Record<"waitingTime" | "flightDelays" | "cancellation" | "payment", string | null> = {
  // Set by the owner on 2026-10-20.
  /** e.g. how long the driver waits after landing / at the pickup address. */
  waitingTime:
    "For airport pickups, your driver waits up to 60 minutes free of charge from the time your flight actually lands. For pickups at an address, the first 15 minutes after your booked pickup time are free. After that, waiting is charged at £20 an hour, worked out by the minute.",
  /** What happens if a flight is early or late. */
  flightDelays: `We follow your flight using the flight number you give us. If it lands late, your 60 free minutes start from the actual landing time, and a delay is never charged. If your flight is cancelled or diverted, please call us on ${site.phone.display} as soon as you can.`,
  /** Cancellation and amendment terms. */
  cancellation: `You can cancel free of charge up to 24 hours before your pickup time, with a full refund of anything you have paid. Cancellations less than 24 hours before pickup, and journeys where the passenger doesn't arrive, are not refunded. To cancel or change a booking, email ${site.email} or call ${site.phone.display}, quoting your booking reference.`,
  /** Accepted payment methods and when payment is taken. */
  payment: null,
};

/**
 * Cancellation and refund terms shown on the Terms and Conditions page.
 * Add only rules the business has confirmed; no fees or refund percentages
 * are stated until they are set here.
 */
export const cancellationPolicy = {
  /** Time taken to process a refund that is eligible under the cancellation policy. */
  refundProcessingBusinessDays: 7,
  /** Further confirmed cancellation rules, one paragraph each. Shown after the refund terms. */
  additionalRules: [
    "Cancel 24 hours or more before your pickup time: full refund of anything you have paid.",
    "Cancel less than 24 hours before your pickup time, or if the passenger doesn't arrive: no refund.",
    `To cancel, email ${site.email} or call ${site.phone.display}, quoting your booking reference. We will confirm the cancellation by email.`,
  ] as string[],
};
