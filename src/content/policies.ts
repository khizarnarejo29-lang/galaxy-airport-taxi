/**
 * Customer policies. Each one stays hidden (pages and FAQs skip it) until it is
 * written here, so the site never states a policy the business hasn't set.
 */
export const policies: Record<"waitingTime" | "flightDelays" | "cancellation" | "payment", string | null> = {
  /** e.g. how long the driver waits after landing / at the pickup address. */
  waitingTime: null,
  /** What happens if a flight is early or late. */
  flightDelays: null,
  /** Cancellation and amendment terms. */
  cancellation: null,
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
  additionalRules: [] as string[],
};
