/** Operational limits for online bookings. Adjust freely. */
export const bookingRules = {
  /** Minimum time between booking and pickup. */
  minNoticeMinutes: 180,
  /** How far ahead a journey can be booked. */
  maxDaysAhead: 365,
  maxExtraStops: 2,
  maxChildSeats: 3,
  /** How long a quoted price is held. */
  quoteValidityMinutes: 30,
  /** An address this close to the airport is treated as the airport itself. */
  sameLocationMiles: 1,
} as const;
