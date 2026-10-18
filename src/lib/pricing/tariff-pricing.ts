/**
 * Prices a whole journey from Galaxy's own location tariff: distance-based fare
 * per airport, vehicle multiplier, extras and event rates (e.g. Christmas). Used
 * only where no reference fare matches, and only once real figures are set.
 */
import type { PricingConfig } from "@/config/pricing";
import { getVehicle } from "@/config/fleet";
import type { AddOns, AirportCode, Direction, JourneyEnd, PriceLine, PricedJourney, VehicleId } from "@/lib/domain/types";
import type { OptionPrice } from "@/lib/reference-fares/journey-pricing";
import { activeEvent, price } from "./engine";

/** The airport and direction of a leg, or null when neither end (or both) is an airport. */
function legOf(start: JourneyEnd, finish: JourneyEnd): { airport: AirportCode; direction: Direction } | null {
  if (finish.kind === "airport" && start.kind !== "airport") return { airport: finish.airport, direction: "to_airport" };
  if (start.kind === "airport" && finish.kind !== "airport") return { airport: start.airport, direction: "from_airport" };
  return null;
}

const prefixed = (lines: PriceLine[], prefix: string) =>
  lines.map((l) => ({ ...l, code: `return_${l.code}`, label: `${prefix}${l.label.charAt(0).toLowerCase()}${l.label.slice(1)}` }));

/**
 * The tariff price for one vehicle, or a reason it can't be priced this way.
 * Child seats are charged once per booking; Meet & Greet on the leg that collects from the airport.
 */
export function tariffPrice(
  journey: PricedJourney,
  vehicleId: VehicleId,
  extras: AddOns,
  config: PricingConfig,
): OptionPrice {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle || journey.passengers > vehicle.maxPassengers) {
    return { pricing: { status: "price_on_request", reason: "TOO_MANY_PASSENGERS" }, lines: [], total: 0 };
  }
  const outward = legOf(journey.pickup, journey.dropoff);
  if (!outward) return { pricing: { status: "price_on_request", reason: "NO_AIRPORT" }, lines: [], total: 0 };

  const out = price(
    {
      ...outward,
      vehicleId,
      distanceMiles: journey.distanceMiles,
      date: journey.date,
      time: journey.time,
      extraStops: journey.extraStops.length,
      addOns: extras,
    },
    config,
  );
  const lines = [...out.lines];
  const events = new Set<string>();
  const outEvent = activeEvent(config, journey.date, journey.time);
  if (outEvent) events.add(outEvent.label);

  const r = journey.returnJourney;
  if (journey.tripType === "return") {
    const back = r && legOf(r.pickup, journey.pickup);
    if (!r || !back) return { pricing: { status: "price_on_request", reason: "NO_AIRPORT" }, lines: [], total: 0 };
    const ret = price(
      {
        ...back,
        vehicleId,
        distanceMiles: r.distanceMiles ?? journey.distanceMiles,
        date: r.date,
        time: r.time,
        extraStops: r.extraStops.length,
        addOns: { meetAndGreet: extras.meetAndGreet, childSeats: 0 },
      },
      config,
    );
    lines.push(...prefixed(ret.lines, "Return "));
    const retEvent = activeEvent(config, r.date, r.time);
    if (retEvent) events.add(retEvent.label);
  }

  return {
    pricing: { status: "tariff", tariffVersion: config.version, events: [...events] },
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}
