import type { ResolvedLocation } from "@/lib/domain/types";

export interface LocationProvider {
  /** Suggestions for a partial postcode or place name. */
  search(query: string): Promise<ResolvedLocation[]>;
  /** Re-resolve an id previously returned by `search`. Null if it no longer exists. */
  resolve(id: string): Promise<ResolvedLocation | null>;
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
