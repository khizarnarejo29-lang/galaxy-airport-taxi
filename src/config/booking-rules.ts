/** Operational limits for online bookings. Adjust freely. */
export const bookingRules = {
  /** Minimum time between booking and pickup. */
  minNoticeMinutes: 180,
  /** How far ahead a journey can be booked. */
  maxDaysAhead: 365,
  /** Per leg: the outward journey and the way back can each have this many. */
  maxExtraStops: 2,
  maxChildSeats: 3,
  /** How long a quoted price is held. */
  quoteValidityMinutes: 30,
} as const;
