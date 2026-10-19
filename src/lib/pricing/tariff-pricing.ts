/**
 * Prices a whole journey from Galaxy's own location tariff: distance-based fare
 * per airport, vehicle multiplier, extras and event rates (e.g. Christmas). Used
 * only where no reference fare matches, and only once real figures are set.
 */
import type { PricingConfig } from "@/config/pricing";
import { getVehicle } from "@/config/fleet";
import type { AddOns, AirportCode, Direction, JourneyEnd, PriceLine, PricedJourney, VehicleId } from "@/lib/domain/types";
import type { OptionPrice } from "@/lib/reference-fares/journey-pricing";
import { haversineMiles } from "@/lib/domain/geo";
import { activeEvent, price } from "./engine";

interface Leg {
  airport: AirportCode;
  direction: Direction;
  terminal?: string;
  /** The London end of the leg. */
  address: Extract<JourneyEnd, { kind: "address" }>["address"];
}

/** The airport, direction and London end of a leg, or null when neither end (or both) is an airport. */
function legOf(start: JourneyEnd, finish: JourneyEnd): Leg | null {
  if (finish.kind === "airport" && start.kind === "address")
    return { airport: finish.airport, direction: "to_airport", terminal: finish.terminal, address: start.address };
  if (start.kind === "airport" && finish.kind === "address")
    return { airport: start.airport, direction: "from_airport", terminal: start.terminal, address: finish.address };
  return null;
}

const inCentralLondon = (leg: Leg, config: PricingConfig) =>
  Boolean(config.centralZone && haversineMiles(leg.address, config.centralZone.centre) <= config.centralZone.radiusMiles);

const legInput = (leg: Leg, config: PricingConfig, returnBooking: boolean) => ({
  airport: leg.airport,
  direction: leg.direction,
  terminal: leg.terminal,
  central: inCentralLondon(leg, config),
  returnBooking,
});

const onRequest = (reason: string): OptionPrice => ({ pricing: { status: "price_on_request", reason }, lines: [], total: 0 });

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
  if (!outward) return onRequest("NO_AIRPORT");
  // An extra the tariff has no price for is never guessed.
  const stops = journey.extraStops.length + (journey.returnJourney?.extraStops.length ?? 0);
  if (
    (extras.meetAndGreet && config.extras.meetAndGreet === null) ||
    (extras.childSeats > 0 && config.extras.childSeat === null) ||
    (stops > 0 && config.extras.extraStop === null)
  ) {
    return onRequest("EXTRA_NOT_PRICED");
  }
  const isReturn = journey.tripType === "return";

  const out = price(
    {
      ...legInput(outward, config, isReturn),
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
  if (isReturn) {
    const back = r && legOf(r.pickup, journey.pickup);
    if (!r || !back) return onRequest("NO_AIRPORT");
    const ret = price(
      {
        ...legInput(back, config, true),
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
