/**
 * Journey ends and the rules that follow from them. Pure: no lookups, no
 * framework imports. Shared by the calculator, the quote and booking code,
 * emails and fare matching, so they always agree.
 */
import { getAirport } from "./airports";
import type { AirportCode, JourneyEnd, JourneyKind, PricedJourney } from "./types";

/** The parts of an end these helpers need, in either the request or the priced shape. */
type EndLike = { kind: "address" } | { kind: "airport"; airport: AirportCode };

/** To the airport, from the airport, or address to address. Null for airport to airport, which is never allowed. */
export function journeyKind(pickup: EndLike, dropoff: EndLike): JourneyKind | null {
  if (pickup.kind === "airport") return dropoff.kind === "airport" ? null : "from_airport";
  return dropoff.kind === "airport" ? "to_airport" : "address_to_address";
}

/**
 * Meet & Greet is for being collected from an airport: it's offered when the
 * outward pickup or the return pickup is an airport, and recorded once per booking.
 */
export function meetAndGreetAllowed(journey: { pickup: EndLike; returnJourney?: { pickup: EndLike } }): boolean {
  return journey.pickup.kind === "airport" || journey.returnJourney?.pickup.kind === "airport";
}

/** The airport this journey uses, if any. A journey never has two. */
export function journeyAirport(journey: Pick<PricedJourney, "pickup" | "dropoff">): AirportCode | undefined {
  const end = [journey.pickup, journey.dropoff].find((e) => e.kind === "airport");
  return end?.kind === "airport" ? end.airport : undefined;
}

/** "Heathrow Airport, Terminal 5", or "1 Example Road, SW1A 1AA". */
export function describeEnd(end: JourneyEnd, line1 = end.kind === "address" ? end.address.line1 : undefined): string {
  if (end.kind === "airport") {
    const airport = getAirport(end.airport);
    const terminal = airport?.terminals.find((t) => t.id === end.terminal)?.name;
    return [airport?.name ?? end.airport, terminal].filter(Boolean).join(", ");
  }
  return [line1, end.address.postcode ?? end.address.label].filter(Boolean).join(", ");
}
