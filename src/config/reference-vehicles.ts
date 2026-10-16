import type { VehicleId } from "@/lib/domain/types";
import type { Pence } from "@/lib/utils/money";

/**
 * Settings for reference-fare pricing: Galaxy charges a fixed amount less
 * than a matching, owner-approved reference fare. Nothing here is a price.
 */
export const referenceFareRules = {
  /**
   * Stored with every quote and booking; quotes signed under another version are refused.
   * Version 2: journeys and fares have a pickup and a drop-off, each an address or an airport.
   */
  pricingVersion: "reference-fares-2",
  /** Taken off the whole booking total once — never per leg or per item. */
  discountPence: 200 as Pence,
  /** A fare can be used for this long after it was checked. */
  validForDays: 7,
} as const;

/** Vehicle classes as named on the reference website's fare list. */
export const referenceVehicles = [
  "saloon_car",
  "executive_car",
  "estate_car",
  "people_carrier",
  "executive_people_carrier",
  "minibus_8_seater",
] as const;

export type ReferenceVehicle = (typeof referenceVehicles)[number];

/** Classes that must never be used for Galaxy pricing. */
export const excludedReferenceVehicles: readonly ReferenceVehicle[] = [
  // No confirmed Galaxy equivalent.
  "executive_people_carrier",
];

/** Provisional mapping approved by the owner. A vehicle missing here is never priced. */
export const vehicleMapping: Partial<Record<VehicleId, ReferenceVehicle>> = {
  saloon: "saloon_car",
  estate: "estate_car",
  executive: "executive_car",
  mpv: "people_carrier",
  minibus: "minibus_8_seater",
};

/** Where the surcharge windows below were read, and when. */
export const holidaySurchargeSource = {
  url: "https://www.airporttaxis-uk.co.uk/TAndC",
  checkedOn: "2026-10-12",
  /**
   * The terms add "other days may also be affected", so a date outside these
   * windows is not assumed to be surcharge-free: each fare also lists the
   * travel dates its price was verified for (`verifiedTravelDates`).
   */
  note: "50% surcharge on published prices in these windows; other days may also be affected.",
} as const;

/**
 * London-time windows the reference site publishes as surcharged. Journeys
 * inside them are never priced. Dates are MM-DD; a window may cross the new year.
 */
export const holidayWindows = [
  { from: { date: "12-24", time: "18:00" }, to: { date: "12-26", time: "23:59" } },
  { from: { date: "12-31", time: "18:00" }, to: { date: "01-01", time: "23:59" } },
] as const;
