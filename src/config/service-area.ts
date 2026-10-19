/**
 * Which addresses count as "London" for an airport transfer.
 * Coverage is not finalised — every rule here can be changed without
 * touching the calculator. An address is covered when ANY include rule
 * matches and NO exclude rule matches.
 */
export interface ServiceAreaConfig {
  /** Shown to customers, e.g. "Greater London". */
  label: string;
  /** postcodes.io `region` values that are covered. "London" = Greater London. */
  regions: string[];
  /** Extra postcode areas outside those regions, e.g. ["CM", "SL"]. */
  extraPostcodeAreas: string[];
  /** Extra postcode districts, e.g. ["EN6", "WD6"]. */
  extraPostcodeDistricts: string[];
  /** Districts never covered, even if another rule matches. */
  excludedPostcodeDistricts: string[];
  /** Optional radius rule; null disables it. */
  radius: { centre: { lat: number; lng: number }; miles: number } | null;
  /** Every UK address is covered (still subject to `excludedPostcodeDistricts`). */
  wholeUk?: boolean;
}

export const serviceArea: ServiceAreaConfig = {
  // Owner's decision (2026-10-19): the whole UK, to and from the five London airports.
  label: "the UK",
  wholeUk: true,
  regions: ["London"],
  extraPostcodeAreas: [],
  extraPostcodeDistricts: [],
  excludedPostcodeDistricts: [],
  radius: null,
};
