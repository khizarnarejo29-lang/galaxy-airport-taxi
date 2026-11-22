import type { AirportCode, LatLng, VehicleId } from "@/lib/domain/types";
import type { Pence } from "@/lib/utils/money";

export interface AirportTariff {
  /** Fare for the first `includedMiles`. */
  baseFare: Pence;
  includedMiles: number;
  perMile: Pence;
  /** Floor for the saloon journey fare, before the vehicle multiplier. */
  minimumFare: Pence;
  /** Charge passed on for dropping off at the terminal (to_airport). */
  dropOffCharge: Pence;
  /** Short-stay parking while the driver waits (from_airport). */
  pickupParking: Pence;
  /** Added to the saloon fare when the London end is inside `centralZone`. */
  centralSupplement?: Pence;
  /** Added to the saloon fare for a terminal (negative for a cheaper one), keyed by terminal id. */
  terminalAdjustments?: Partial<Record<string, Pence>>;
}

export interface TimeSurcharge {
  label: string;
  /** London time, HH:mm. A window may cross midnight (e.g. 23:00 → 05:00). */
  from: string;
  to: string;
  percent: number;
  enabled: boolean;
}

/**
 * A date window (London time) when the whole journey fare is multiplied, e.g.
 * Christmas. Dates are MM-DD, so the same window applies every year; a window
 * may cross the new year. Where windows overlap, the highest multiplier applies.
 */
export interface EventSurcharge {
  label: string;
  from: { date: string; time: string };
  to: { date: string; time: string };
  /** 2 doubles the journey fare. Extras and airport charges are not multiplied. */
  multiplier: number;
  enabled: boolean;
}

/** Journeys with no airport at either end (to a hospital, station, office, shop…). */
export interface LocalTariff {
  /** Saloon fare for the first `includedMiles`. */
  baseFare: Pence;
  includedMiles: number;
  perMile: Pence;
  /** After this many chargeable miles, `longPerMile` applies instead. */
  longAfterMiles: number;
  longPerMile: Pence;
  minimumFare: Pence;
  /** Added when either end is within `centralRadiusMiles` of `centralZone.centre`. */
  centralSupplement: Pence;
  centralRadiusMiles: number;
  /** Per-vehicle multipliers that differ from `vehicleMultipliers` on local journeys. */
  vehicleMultipliers?: Partial<Record<VehicleId, number>>;
  /** Per-vehicle fixed amounts that differ from `vehicleSurcharges` on local journeys. */
  vehicleSurcharges?: Partial<Record<VehicleId, Pence>>;
}

export interface PricingConfig {
  /** Stored with every quote and booking. Change it whenever any figure changes. */
  version: string;
  isPlaceholder: boolean;
  /** Journey fares are rounded to this step (100 = whole pounds). */
  roundTo: Pence;
  airports: Record<AirportCode, AirportTariff>;
  vehicleMultipliers: Record<VehicleId, number>;
  /** A fixed amount added to the vehicle's fare after its multiplier (e.g. the 8-seater). */
  vehicleSurcharges?: Partial<Record<VehicleId, Pence>>;
  /** Each extra's price. Null: not priced by the tariff, so a journey with it is price on request. */
  extras: { meetAndGreet: Pence | null; childSeat: Pence | null; extraStop: Pence | null };
  /** Central London, where `centralSupplement` applies: within this many miles of the centre. */
  centralZone?: { centre: LatLng; radiusMiles: number };
  /** Both legs of a return booking are charged this much less. Shown only as lower leg fares. */
  returnDiscountPercent?: number;
  /** For an address outside Greater London: this rate per mile instead of the airport's `perMile`. */
  outsideLondon?: {
    perMile: Pence;
    /**
     * With this set, an address outside Greater London is priced as this plus `perMile` for
     * every mile, whatever the airport (no airport base fare or included miles).
     */
    baseFare?: Pence;
  };
  /** Address-to-address journeys. Without it they are price on request. */
  local?: LocalTariff;
  /**
   * One-way fares between two airports, per vehicle, keyed by the two codes in
   * alphabetical order (e.g. "LGW-LHR"); the same in both directions. A pair or
   * vehicle not listed is price on request.
   */
  betweenAirports?: Partial<Record<string, Partial<Record<VehicleId, Pence>>>>;
  timeSurcharges: TimeSurcharge[];
  eventSurcharges: EventSurcharge[];
}

/**
 * Galaxy's location tariff, set from 32 quotes on the reference website
 * (2026-10-19): six London postcodes to each airport, every vehicle. At each of
 * them this tariff is at least £3 under the reference price (the £2 rule plus a
 * £1 cushion for the places in between). Re-check with `npm run tariff:check`
 * whenever a figure changes. Prices include airport drop-off and parking, as the
 * reference prices do.
 *
 * Extras, also from the reference website: Meet & Greet is +£6 there (Heathrow and
 * Stansted). A stop on the way cost £16 more there (E1 5NF via SW1A 1AA to Heathrow T5);
 * here a stop is £10 plus the extra miles. The reference site offers no child seats;
 * Galaxy's are free.
 */
export const pricing: PricingConfig = {
  version: "galaxy-2026-10-21-2",
  isPlaceholder: false,
  roundTo: 100,
  airports: {
    // Fitted to Terminal 5; Terminals 2, 3 and 4 are cheaper on the reference site (T2 £8 less).
    LHR: {
      baseFare: 5300,
      includedMiles: 10,
      perMile: 230,
      minimumFare: 5300,
      dropOffCharge: 0,
      pickupParking: 0,
      terminalAdjustments: { T2: -800, T3: -800, T4: -800 },
    },
    LGW: { baseFare: 4200, includedMiles: 9, perMile: 170, minimumFare: 4200, dropOffCharge: 0, pickupParking: 0, centralSupplement: 2400 },
    STN: { baseFare: 1900, includedMiles: 0, perMile: 180, minimumFare: 1900, dropOffCharge: 0, pickupParking: 0 },
    LTN: { baseFare: 3900, includedMiles: 17, perMile: 255, minimumFare: 3900, dropOffCharge: 0, pickupParking: 0 },
    LCY: { baseFare: 2000, includedMiles: 1, perMile: 295, minimumFare: 2000, dropOffCharge: 0, pickupParking: 0, centralSupplement: 700 },
  },
  vehicleMultipliers: {
    saloon: 1,
    estate: 1.12,
    executive: 1.29,
    mpv: 1.29,
    minibus: 1.49,
  },
  // Owner's decision (2026-10-20): child seats are free.
  extras: { meetAndGreet: 600, childSeat: 0, extraStop: 1000 },
  // Within 3 miles of Charing Cross: the reference site charges more for central London.
  centralZone: { centre: { lat: 51.5073, lng: -0.1276 }, radiusMiles: 3 },
  // The reference site takes 5% off both journeys of a return.
  returnDiscountPercent: 5,
  // Outside London the reference site charges much less per mile: B1 1BB to Heathrow T5 £183,
  // M1 1AE to Heathrow T5 £287, BN1 1AA to Gatwick South £71, MK9 1AA to Luton £65 (2026-10-19).
  outsideLondon: { perMile: 110 },
  // Any journey, not only airports (owner's decision, 2026-10-21), at the reference site's price
  // (owner's decision, 2026-11-22). Set from 17 of its quotes on 2026-11-22, short London trips to
  // Birmingham: never above any of them for any vehicle, and level with 16 of the 84 (see
  // galaxy-tariff.test.ts). Every vehicle is listed so the airport figures never leak in.
  local: {
    baseFare: 4100,
    includedMiles: 4,
    perMile: 140,
    longAfterMiles: 25,
    longPerMile: 130,
    minimumFare: 4100,
    centralSupplement: 1200,
    centralRadiusMiles: 1.5,
    vehicleMultipliers: { saloon: 1, estate: 1.12, executive: 1.29, mpv: 1.29, minibus: 1.13 },
    vehicleSurcharges: { saloon: 0, estate: 100, executive: 0, mpv: 0, minibus: 3200 },
  },
  // Owner's rule (2026-11-22): the same as the reference site. Its one-way prices between airports,
  // the same in both directions, checked on 2026-11-22. Where its terminals differed (Heathrow T2
  // to Gatwick North against T5 to South) the lower price per vehicle is used.
  betweenAirports: {
    "LGW-LHR": { saloon: 8500, estate: 9800, executive: 11500, mpv: 11500, minibus: 13100 },
    "LHR-STN": { saloon: 10800, estate: 12400, executive: 14500, mpv: 14500, minibus: 16200 },
    "LHR-LTN": { saloon: 7700, estate: 9000, executive: 10500, mpv: 10500, minibus: 12500 },
    "LCY-LHR": { saloon: 11700, estate: 13400, executive: 15800, mpv: 15800, minibus: 17500 },
    "LGW-STN": { saloon: 12400, estate: 14200, executive: 16700, mpv: 16700, minibus: 18600 },
    "LGW-LTN": { saloon: 12900, estate: 14900, executive: 17500, mpv: 17500, minibus: 19400 },
    "LCY-LGW": { saloon: 9600, estate: 11000, executive: 12900, mpv: 12900, minibus: 14400 },
    "LTN-STN": { saloon: 10200, estate: 11700, executive: 13700, mpv: 13700, minibus: 15200 },
    "LCY-STN": { saloon: 7800, estate: 8900, executive: 10500, mpv: 10500, minibus: 12400 },
    "LCY-LTN": { saloon: 9800, estate: 11300, executive: 13300, mpv: 13300, minibus: 14700 },
  },
  timeSurcharges: [{ label: "Late-night surcharge", from: "23:00", to: "05:00", percent: 10, enabled: false }],
  // Owner's decision: double fares at Christmas and New Year. The windows are the ones the
  // reference site publishes for its own holiday surcharge (see holidayWindows).
  eventSurcharges: [
    { label: "Christmas rate", from: { date: "12-24", time: "18:00" }, to: { date: "12-26", time: "23:59" }, multiplier: 2, enabled: true },
    { label: "New Year rate", from: { date: "12-31", time: "18:00" }, to: { date: "01-01", time: "23:59" }, multiplier: 2, enabled: true },
  ],
};

/**
 * The tariff to price with when no reference fare matches, or null when there is none.
 * Placeholder figures are never used in production. Outside production they can be
 * switched on for testing with PLACEHOLDER_TARIFF=on.
 */
export function activeTariff(env: Partial<Record<string, string | undefined>> = process.env, config: PricingConfig = pricing): PricingConfig | null {
  if (!config.isPlaceholder) return config;
  return env.NODE_ENV !== "production" && env.PLACEHOLDER_TARIFF === "on" ? config : null;
}
