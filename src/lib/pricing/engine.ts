/**
 * The pricing engine: pure, deterministic and framework-free.
 * The same function runs in the browser (live totals) and on the server
 * (authoritative price when a booking is created).
 */
import type { EventSurcharge, PricingConfig, TimeSurcharge } from "@/config/pricing";
import type { AddOns, AirportCode, Direction, PriceLine, VehicleId } from "@/lib/domain/types";
import { roundTo, type Pence } from "@/lib/utils/money";

export interface PriceInput {
  direction: Direction;
  airport: AirportCode;
  vehicleId: VehicleId;
  distanceMiles: number;
  /** London local time, HH:mm. */
  time: string;
  /** London local date, YYYY-MM-DD. Needed for event surcharges such as Christmas. */
  date?: string;
  extraStops: number;
  addOns?: AddOns;
  /** The London end is in central London (`centralZone`). */
  central?: boolean;
  /** Terminal id at the airport end, for `terminalAdjustments`. */
  terminal?: string;
  /** Part of a return booking: `returnDiscountPercent` comes off the journey fare. */
  returnBooking?: boolean;
  /** The address is outside Greater London: `outsideLondon.perMile` applies. */
  outsideLondon?: boolean;
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

/** Minutes into the year for an MM-DD date and HH:mm time (leap years don't matter at this scale). */
function yearMinute(mmdd: string, hhmm: string): number {
  const [m, d] = mmdd.split("-").map(Number);
  return ((m - 1) * 31 + (d - 1)) * 24 * 60 + toMinutes(hhmm);
}

/** Whether a London-time pickup falls inside an event window. Both ends are included. */
export function eventApplies(s: EventSurcharge, date: string, time: string): boolean {
  if (!s.enabled) return false;
  const t = yearMinute(date.slice(5), time);
  const from = yearMinute(s.from.date, s.from.time);
  const to = yearMinute(s.to.date, s.to.time);
  return from <= to ? t >= from && t <= to : t >= from || t <= to;
}

/** The event with the highest multiplier at this pickup, if any. */
export function activeEvent(config: PricingConfig, date: string | undefined, time: string): EventSurcharge | undefined {
  if (!date) return undefined;
  return config.eventSurcharges
    .filter((s) => s.multiplier > 1 && eventApplies(s, date, time))
    .sort((a, b) => b.multiplier - a.multiplier)[0];
}

export function journeyFare(input: PriceInput, config: PricingConfig): Pence {
  const tariff = config.airports[input.airport];
  const chargeableMiles = Math.max(0, input.distanceMiles - tariff.includedMiles);
  const perMile = (input.outsideLondon && config.outsideLondon?.perMile) || tariff.perMile;
  const adjustments =
    (input.central ? (tariff.centralSupplement ?? 0) : 0) + ((input.terminal && tariff.terminalAdjustments?.[input.terminal]) || 0);
  const saloonFare = Math.max(tariff.minimumFare, tariff.baseFare + chargeableMiles * perMile + adjustments);
  const discount = input.returnBooking ? (config.returnDiscountPercent ?? 0) / 100 : 0;
  return roundTo(saloonFare * (1 - discount) * config.vehicleMultipliers[input.vehicleId], config.roundTo);
}

/** What every journey shares: the fare, event and time surcharges on it, then extra stops. */
function fareLines(fare: Pence, input: Pick<PriceInput, "date" | "time" | "extraStops">, config: PricingConfig): PriceLine[] {
  const lines: PriceLine[] = [{ code: "journey", label: "Journey fare", amount: fare }];

  // Events (Christmas, New Year…) multiply the journey fare only, not extras or airport charges.
  const event = activeEvent(config, input.date, input.time);
  if (event) {
    lines.push({ code: "event_surcharge", label: event.label, amount: roundTo(fare * (event.multiplier - 1), config.roundTo) });
  }

  for (const s of config.timeSurcharges) {
    if (surchargeApplies(s, input.time)) {
      lines.push({ code: "time_surcharge", label: s.label, amount: roundTo((fare * s.percent) / 100, 100) });
    }
  }

  if (input.extraStops > 0) {
    lines.push({
      code: "extra_stops",
      label: input.extraStops === 1 ? "Extra stop" : `Extra stops × ${input.extraStops}`,
      amount: input.extraStops * (config.extras.extraStop ?? 0),
    });
  }
  return lines;
}

/** Free child seats add no line; the booking still records how many. */
function childSeatLines(addOns: AddOns, config: PricingConfig): PriceLine[] {
  if (addOns.childSeats === 0 || (config.extras.childSeat ?? 0) === 0) return [];
  return [
    {
      code: "child_seats",
      label: addOns.childSeats === 1 ? "Child seat" : `Child seats × ${addOns.childSeats}`,
      amount: addOns.childSeats * (config.extras.childSeat ?? 0),
    },
  ];
}

const withTotal = (lines: PriceLine[]): PriceResult => ({ lines, total: lines.reduce((sum, l) => sum + l.amount, 0) });

export function price(input: PriceInput, config: PricingConfig): PriceResult {
  const tariff = config.airports[input.airport];
  const addOns = input.addOns ?? NO_ADD_ONS;
  const lines = fareLines(journeyFare(input, config), input, config);

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
    lines.push({ code: "meet_and_greet", label: "Meet & Greet", amount: config.extras.meetAndGreet ?? 0 });
  }

  return withTotal([...lines, ...childSeatLines(addOns, config)]);
}

export type LocalPriceInput = Omit<PriceInput, "airport" | "direction" | "terminal" | "outsideLondon">;

/** Saloon fare for a journey with no airport, then the vehicle's multiplier. Null without a local tariff. */
export function localJourneyFare(input: LocalPriceInput, config: PricingConfig): Pence | null {
  const local = config.local;
  if (!local) return null;
  const chargeable = Math.max(0, input.distanceMiles - local.includedMiles);
  const miles = Math.min(chargeable, local.longAfterMiles) * local.perMile + Math.max(0, chargeable - local.longAfterMiles) * local.longPerMile;
  const saloonFare = Math.max(local.minimumFare, local.baseFare + miles + (input.central ? local.centralSupplement : 0));
  const discount = input.returnBooking ? (config.returnDiscountPercent ?? 0) / 100 : 0;
  const multiplier = local.vehicleMultipliers?.[input.vehicleId] ?? config.vehicleMultipliers[input.vehicleId];
  return roundTo(saloonFare * (1 - discount) * multiplier, config.roundTo);
}

/** A journey between two addresses (hospital, station, office, home…). Null without a local tariff. */
export function localPrice(input: LocalPriceInput, config: PricingConfig): PriceResult | null {
  const fare = localJourneyFare(input, config);
  if (fare === null) return null;
  return withTotal([...fareLines(fare, input, config), ...childSeatLines(input.addOns ?? NO_ADD_ONS, config)]);
}

export interface BetweenAirportsInput extends Pick<PriceInput, "date" | "time" | "extraStops" | "addOns" | "returnBooking"> {
  from: AirportCode;
  to: AirportCode;
  vehicleId: VehicleId;
}

/** The listed fare between two airports, the same both ways, or null if that pair or vehicle isn't listed. */
export function betweenAirportsFare(input: Pick<BetweenAirportsInput, "from" | "to" | "vehicleId" | "returnBooking">, config: PricingConfig): Pence | null {
  const key = [input.from, input.to].sort().join("-");
  const fare = config.betweenAirports?.[key]?.[input.vehicleId];
  if (fare === undefined || input.from === input.to) return null;
  const discount = input.returnBooking ? (config.returnDiscountPercent ?? 0) / 100 : 0;
  return roundTo(fare * (1 - discount), config.roundTo);
}

/** A transfer from one airport to another. Meet & Greet applies: the driver collects from arrivals. */
export function betweenAirportsPrice(input: BetweenAirportsInput, config: PricingConfig): PriceResult | null {
  const fare = betweenAirportsFare(input, config);
  if (fare === null) return null;
  const addOns = input.addOns ?? NO_ADD_ONS;
  const lines = fareLines(fare, input, config);
  if (addOns.meetAndGreet) lines.push({ code: "meet_and_greet", label: "Meet & Greet", amount: config.extras.meetAndGreet ?? 0 });
  return withTotal([...lines, ...childSeatLines(addOns, config)]);
}
