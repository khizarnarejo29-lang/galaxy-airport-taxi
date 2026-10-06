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
}

export const serviceArea: ServiceAreaConfig = {
  label: "Greater London",
  regions: ["London"],
  extraPostcodeAreas: [],
  extraPostcodeDistricts: [],
  excludedPostcodeDistricts: [],
  radius: null,
};
