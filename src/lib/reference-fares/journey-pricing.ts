/**
 * Connects the quote/booking flow to reference-fare matching. Server-side
 * only: prices come from stored, approved fares and nothing the browser sends.
 */
import { meetAndGreetAllowed } from "@/lib/domain/route";
import type { AddOns, JourneyEnd, OptionPricing, PriceLine, PricedJourney, VehicleId } from "@/lib/domain/types";
import type { Pence } from "@/lib/utils/money";
import { matchReferenceFare, type FareQuery, type QueryEnd } from "./match";
import type { ReferenceFare } from "./schema";

export interface OptionPrice {
  pricing: OptionPricing;
  lines: PriceLine[];
  total: Pence;
}

/** Meet & Greet only exists where we collect from an airport: an airport pickup on either leg. */
export function effectiveExtras(journey: Pick<PricedJourney, "pickup" | "returnJourney">, addOns: AddOns): AddOns {
  return { meetAndGreet: meetAndGreetAllowed(journey) && addOns.meetAndGreet, childSeats: addOns.childSeats };
}

/** An end as fares record it, or null for an area without a full postcode (which can never match). */
function queryEnd(end: JourneyEnd): QueryEnd | null {
  if (end.kind === "airport") return { kind: "airport", airport: end.airport, terminal: end.terminal ?? null };
  if (!end.address.postcode) return null;
  return { kind: "address", postcode: end.address.postcode, line1: end.address.line1?.trim() || undefined };
}

/** The exact journey to look up, or null when it can't match any fare (e.g. no postcode or luggage details). */
export function fareQueryFor(journey: PricedJourney, vehicleId: VehicleId, extras: AddOns): FareQuery | null {
  if (!journey.luggageCategory) return null;
  const pickup = queryEnd(journey.pickup);
  const dropoff = queryEnd(journey.dropoff);
  if (!pickup || !dropoff) return null;

  const r = journey.returnJourney;
  let returnLeg: FareQuery["returnLeg"];
  if (journey.tripType === "return") {
    const returnPickup = r && queryEnd(r.pickup);
    if (!r || !returnPickup) return null;
    // The way back always ends at the outward pickup, so only its start and stops are looked up.
    returnLeg = { pickup: returnPickup, stops: r.extraStops.map((s) => s.postcode ?? ""), date: r.date, time: r.time };
  }

  return {
    vehicleId,
    tripType: journey.tripType,
    pickup,
    dropoff,
    stops: journey.extraStops.map((s) => s.postcode ?? ""),
    date: journey.date,
    time: journey.time,
    returnLeg,
    party: { passengers: journey.passengers, luggage: journey.luggageCategory },
    extras,
  };
}

/** The Galaxy price for one vehicle, or price on request. Never falls back to any tariff. */
export function priceVehicle(
  journey: PricedJourney,
  vehicleId: VehicleId,
  extras: AddOns,
  fares: readonly ReferenceFare[],
  now: Date,
): OptionPrice {
  // Large or unusual items (bikes, golf bags…) are never covered by a checked fare. Anything but an
  // explicit "no" is treated the same way, so a missing answer can never produce a price.
  if (journey.largeItems !== false) {
    return { pricing: { status: "price_on_request", reason: "LARGE_ITEMS" }, lines: [], total: 0 };
  }
  const query = fareQueryFor(journey, vehicleId, extras);
  if (!query) {
    const reason = journey.luggageCategory ? "NO_MATCHING_FARE" : "PARTY_UNCONFIRMED";
    return { pricing: { status: "price_on_request", reason }, lines: [], total: 0 };
  }

  const match = matchReferenceFare(query, fares, now);
  if (match.status !== "matched") return { pricing: { status: "price_on_request", reason: match.reason }, lines: [], total: 0 };

  return {
    pricing: {
      status: "priced",
      fareId: match.fare.id,
      referenceTotal: match.referenceTotal,
      checkedAt: match.fare.checkedAt,
      validUntil: match.validUntil,
      flags: match.flags,
    },
    lines: [{ code: "fixed_fare", label: journey.tripType === "return" ? "Fixed return fare" : "Fixed fare", amount: match.galaxyTotal }],
    total: match.galaxyTotal,
  };
}
