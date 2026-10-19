import type { LocationSearchResult, ResolvedLocation } from "@/lib/domain/types";

export interface LocationProvider {
  /**
   * Suggestions for a partial address, postcode or place name. A `suggestion`
   * has no coordinates yet: the browser resolves it by id once it is chosen.
   * `session` groups one customer's typing and choice (Google bills them together).
   */
  search(query: string, session?: string): Promise<LocationSearchResult[]>;
  /** Re-resolve an id previously returned by `search`. Null if it no longer exists. */
  resolve(id: string, session?: string): Promise<ResolvedLocation | null>;
  /** Look up a full postcode. Null if it doesn't exist. */
  lookupPostcode(postcode: string): Promise<ResolvedLocation | null>;
}

/** The provider couldn't be reached or answered unexpectedly. */
export class LocationLookupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LocationLookupError";
  }
}
