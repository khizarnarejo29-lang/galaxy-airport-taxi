import type { AirportCode, VehicleId } from "@/lib/domain/types";
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
  extras: { meetAndGreet: Pence; childSeat: Pence; extraStop: Pence };
  timeSurcharges: TimeSurcharge[];
  eventSurcharges: EventSurcharge[];
}

/**
 * PLACEHOLDER FIGURES — for building and testing only.
 * Replace every amount with Galaxy Airport Taxi's real tariff before launch,
 * and confirm current airport drop-off and parking charges.
 */
export const pricing: PricingConfig = {
  version: "placeholder-2026-10-05",
  isPlaceholder: true,
  roundTo: 100,
  airports: {
    LHR: { baseFare: 4000, includedMiles: 12, perMile: 220, minimumFare: 4500, dropOffCharge: 700, pickupParking: 800 },
    LGW: { baseFare: 5500, includedMiles: 20, perMile: 210, minimumFare: 6000, dropOffCharge: 1000, pickupParking: 800 },
    STN: { baseFare: 5500, includedMiles: 20, perMile: 210, minimumFare: 6000, dropOffCharge: 1000, pickupParking: 800 },
    LTN: { baseFare: 5000, includedMiles: 18, perMile: 210, minimumFare: 5500, dropOffCharge: 700, pickupParking: 800 },
    LCY: { baseFare: 3000, includedMiles: 6, perMile: 230, minimumFare: 3500, dropOffCharge: 0, pickupParking: 600 },
  },
  vehicleMultipliers: {
    saloon: 1,
    estate: 1.15,
    executive: 1.5,
    mpv: 1.35,
    minibus: 1.8,
  },
  extras: { meetAndGreet: 1500, childSeat: 800, extraStop: 1000 },
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
