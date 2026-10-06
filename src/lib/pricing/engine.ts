/**
 * The pricing engine: pure, deterministic and framework-free.
 * The same function runs in the browser (live totals) and on the server
 * (authoritative price when a booking is created).
 */
import type { PricingConfig, TimeSurcharge } from "@/config/pricing";
import type { AddOns, AirportCode, Direction, PriceLine, VehicleId } from "@/lib/domain/types";
import { roundTo, type Pence } from "@/lib/utils/money";

export interface PriceInput {
  direction: Direction;
  airport: AirportCode;
  vehicleId: VehicleId;
  distanceMiles: number;
  /** London local time, HH:mm. */
  time: string;
  extraStops: number;
  addOns?: AddOns;
}

export interface PriceResult {
  lines: PriceLine[];
  total: Pence;
}

const NO_ADD_ONS: AddOns = { meetAndGreet: false, childSeats: 0 };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function surchargeApplies(s: TimeSurcharge, time: string): boolean {
  if (!s.enabled) return false;
  const t = toMinutes(time);
  const from = toMinutes(s.from);
  const to = toMinutes(s.to);
  return from <= to ? t >= from && t < to : t >= from || t < to;
}

export function journeyFare(input: PriceInput, config: PricingConfig): Pence {
  const tariff = config.airports[input.airport];
  const chargeableMiles = Math.max(0, input.distanceMiles - tariff.includedMiles);
  const saloonFare = Math.max(tariff.minimumFare, tariff.baseFare + chargeableMiles * tariff.perMile);
  return roundTo(saloonFare * config.vehicleMultipliers[input.vehicleId], config.roundTo);
}

export function price(input: PriceInput, config: PricingConfig): PriceResult {
  const tariff = config.airports[input.airport];
  const addOns = input.addOns ?? NO_ADD_ONS;
  const fare = journeyFare(input, config);
  const lines: PriceLine[] = [{ code: "journey", label: "Journey fare", amount: fare }];

  for (const s of config.timeSurcharges) {
    if (surchargeApplies(s, input.time)) {
      lines.push({ code: "time_surcharge", label: s.label, amount: roundTo((fare * s.percent) / 100, 100) });
    }
  }

  if (input.extraStops > 0) {
    lines.push({
      code: "extra_stops",
      label: input.extraStops === 1 ? "Extra stop" : `Extra stops × ${input.extraStops}`,
      amount: input.extraStops * config.extras.extraStop,
    });
  }

  const airportCharge = input.direction === "to_airport" ? tariff.dropOffCharge : tariff.pickupParking;
  if (airportCharge > 0) {
    lines.push({
      code: "airport_charge",
      label: input.direction === "to_airport" ? "Airport drop-off charge" : "Airport parking",
      amount: airportCharge,
    });
  }

  // Meet & Greet only applies when we collect from arrivals.
  if (addOns.meetAndGreet && input.direction === "from_airport") {
    lines.push({ code: "meet_and_greet", label: "Meet & Greet", amount: config.extras.meetAndGreet });
  }

  if (addOns.childSeats > 0) {
    lines.push({
      code: "child_seats",
      label: addOns.childSeats === 1 ? "Child seat" : `Child seats × ${addOns.childSeats}`,
      amount: addOns.childSeats * config.extras.childSeat,
    });
  }

  return { lines, total: lines.reduce((sum, l) => sum + l.amount, 0) };
}
