import { bookingRules } from "@/config/booking-rules";
import { fleet } from "@/config/fleet";
import { pricing, type PricingConfig } from "@/config/pricing";
import { serviceArea, type ServiceAreaConfig } from "@/config/service-area";
import { airports, getAirport } from "@/lib/domain/airports";
import { capacityProblem } from "@/lib/domain/capacity";
import { fieldError } from "@/lib/domain/errors";
import { haversineMiles, isInServiceArea } from "@/lib/domain/geo";
import type { FieldError, JourneyInput, PricedJourney, Quote, QuoteOption, ResolvedLocation } from "@/lib/domain/types";
import { normaliseFlightNumber, validateJourney } from "@/lib/domain/validation";
import { price } from "@/lib/pricing/engine";
import { londonToUtc } from "@/lib/utils/dates";
import type { Services } from "@/lib/services";
import { LocationLookupError } from "@/lib/services/location/types";
import { signQuote } from "./token";

export type QuoteResult =
  | { ok: true; quote: Quote; token: string }
  | { ok: false; status: 400 | 422 | 502; errors: FieldError[] };

interface Options {
  now?: Date;
  config?: PricingConfig;
  area?: ServiceAreaConfig;
}

/** Route checks that need resolved coordinates. */
function routeErrors(field: string, loc: ResolvedLocation, airportCode: string, area: ServiceAreaConfig): FieldError[] {
  const chosen = getAirport(airportCode)!;
  if (haversineMiles(loc, chosen) <= bookingRules.sameLocationMiles) return [fieldError(field, "SAME_LOCATION")];
  const otherAirport = airports.find(
    (a) => a.code !== airportCode && haversineMiles(loc, a) <= bookingRules.sameLocationMiles,
  );
  if (otherAirport) return [fieldError(field, "ROUTE_UNSUPPORTED")];
  if (!isInServiceArea(loc, area)) return [fieldError(field, "ADDRESS_OUTSIDE_AREA")];
  return [];
}

export async function createQuote(
  input: JourneyInput,
  services: Pick<Services, "locations" | "distance">,
  { now = new Date(), config = pricing, area = serviceArea }: Options = {},
): Promise<QuoteResult> {
  const invalid = validateJourney(input, now);
  if (invalid.length) return { ok: false, status: 422, errors: invalid };

  let address: ResolvedLocation | null;
  let stops: (ResolvedLocation | null)[];
  try {
    [address, ...stops] = await Promise.all(
      [input.address, ...input.extraStops].map((a) => services.locations.resolve(a.locationId)),
    );
  } catch (err) {
    if (err instanceof LocationLookupError) {
      console.error("[quote] location lookup failed", err);
      return { ok: false, status: 502, errors: [fieldError("address", "LOCATION_LOOKUP_FAILED")] };
    }
    throw err;
  }

  const errors: FieldError[] = [];
  if (!address) errors.push(fieldError("address", "ADDRESS_REQUIRED"));
  else errors.push(...routeErrors("address", address, input.airport, area));
  stops.forEach((s, i) => {
    if (!s) errors.push(fieldError(`extraStops.${i}`, "ADDRESS_REQUIRED"));
    else if (!isInServiceArea(s, area)) errors.push(fieldError(`extraStops.${i}`, "ADDRESS_OUTSIDE_AREA"));
  });
  if (errors.length) return { ok: false, status: 422, errors };

  const airport = getAirport(input.airport)!;
  const resolvedStops = stops as ResolvedLocation[];
  const route =
    input.direction === "to_airport"
      ? [address!, ...resolvedStops, airport]
      : [airport, ...resolvedStops, address!];
  const distanceMiles = await services.distance.routeMiles(route);

  const passengers = input.passengers!;
  const journey: PricedJourney = {
    direction: input.direction,
    airport: input.airport,
    terminal: airport.terminals.length > 1 ? input.terminal : airport.terminals[0]?.id,
    address: { ...address!, line1: input.address.line1?.trim() || undefined },
    extraStops: resolvedStops.map((s, i) => ({ ...s, line1: input.extraStops[i].line1?.trim() || undefined })),
    date: input.date,
    time: input.time,
    pickupAtUtc: londonToUtc(input.date, input.time).toISOString(),
    passengers,
    luggage: input.luggage,
    flightNumber: input.flightNumber?.trim() ? normaliseFlightNumber(input.flightNumber) : undefined,
    distanceMiles,
  };

  const options: QuoteOption[] = fleet.map((vehicle) => {
    const problem = capacityProblem(vehicle, passengers, input.luggage);
    const { lines, total } = price(
      {
        direction: journey.direction,
        airport: journey.airport,
        vehicleId: vehicle.id,
        distanceMiles,
        time: journey.time,
        extraStops: journey.extraStops.length,
      },
      config,
    );
    return { vehicleId: vehicle.id, available: problem === null, unavailableReason: problem ?? undefined, lines, total };
  });

  const quote: Quote = {
    journey,
    options,
    pricingVersion: config.version,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + bookingRules.quoteValidityMinutes * 60_000).toISOString(),
  };
  return { ok: true, quote, token: signQuote(quote) };
}
