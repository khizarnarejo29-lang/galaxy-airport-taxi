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

export interface PricingConfig {
  /** Stored with every quote and booking. Change it whenever any figure changes. */
  version: string;
  isPlaceholder: boolean;
  /** Journey fares are rounded to this step (100 = whole pounds). */
  roundTo: Pence;
  airports: Record<AirportCode, AirportTariff>;
  vehicleMultipliers: Record<VehicleId, number>;
  /** Each extra's price. Null: not priced by the tariff, so a journey with it is price on request. */
  extras: { meetAndGreet: Pence | null; childSeat: Pence | null; extraStop: Pence | null };
  /** Central London, where `centralSupplement` applies: within this many miles of the centre. */
  centralZone?: { centre: LatLng; radiusMiles: number };
  /** Both legs of a return booking are charged this much less. Shown only as lower leg fares. */
  returnDiscountPercent?: number;
  /** For an address outside Greater London: this rate per mile instead of the airport's `perMile`. */
  outsideLondon?: { perMile: Pence };
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
 * here a stop is £10 plus the extra miles. The reference site offers no child seats,
 * so those stay price on request until the owner sets a price.
 */
export const pricing: PricingConfig = {
  version: "galaxy-2026-10-19c",
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
  extras: { meetAndGreet: 600, childSeat: null, extraStop: 1000 },
  // Within 3 miles of Charing Cross: the reference site charges more for central London.
  centralZone: { centre: { lat: 51.5073, lng: -0.1276 }, radiusMiles: 3 },
  // The reference site takes 5% off both journeys of a return.
  returnDiscountPercent: 5,
  // Outside London the reference site charges much less per mile: B1 1BB to Heathrow T5 £183,
  // M1 1AE to Heathrow T5 £287, BN1 1AA to Gatwick South £71, MK9 1AA to Luton £65 (2026-10-19).
  outsideLondon: { perMile: 110 },
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
