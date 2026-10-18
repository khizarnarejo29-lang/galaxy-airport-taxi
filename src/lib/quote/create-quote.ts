import { bookingRules } from "@/config/booking-rules";
import { fleet } from "@/config/fleet";
import { referenceFareRules } from "@/config/reference-vehicles";
import { serviceArea, type ServiceAreaConfig } from "@/config/service-area";
import { getAirport } from "@/lib/domain/airports";
import { fieldError } from "@/lib/domain/errors";
import { isInServiceArea, normalisePostcode } from "@/lib/domain/geo";
import type {
  AddressDetail,
  AirportCode,
  FieldError,
  JourneyEnd,
  JourneyEndInput,
  JourneyInput,
  LatLng,
  PricedAddress,
  PricedJourney,
  PricedReturnJourney,
  Quote,
  QuoteOption,
  ResolvedLocation,
} from "@/lib/domain/types";
import { normaliseFlightNumber, validateJourney } from "@/lib/domain/validation";
import { currentReferenceFares, type ReferenceFare } from "@/lib/reference-fares";
import { effectiveExtras, priceVehicle } from "@/lib/reference-fares/journey-pricing";
import { londonToUtc } from "@/lib/utils/dates";
import type { Services } from "@/lib/services";
import { LocationLookupError } from "@/lib/services/location/types";
import { signQuote } from "./token";

export type QuoteResult =
  | { ok: true; quote: Quote; token: string }
  | { ok: false; status: 400 | 422 | 502; errors: FieldError[] };

interface Options {
  now?: Date;
  /** Reference fares to price with; defaults to the stored, validated fare data. */
  fares?: readonly ReferenceFare[];
  area?: ServiceAreaConfig;
}

const NO_EXTRAS = { meetAndGreet: false, childSeats: 0 };

/** Same search result, or the same full postcode. Never decided by distance. */
const samePlace = (a: ResolvedLocation, b: ResolvedLocation) =>
  a.id === b.id || (Boolean(a.postcode) && normalisePostcode(a.postcode ?? "") === normalisePostcode(b.postcode ?? ""));

const lineOf = (detail: AddressDetail) => detail.line1?.trim() || undefined;

const flightOf = (value: string | undefined) => (value?.trim() ? normaliseFlightNumber(value) : undefined);

/** An airport end with its terminal: the chosen one at multi-terminal airports, the only one otherwise. */
function airportEnd(code: AirportCode, terminal: string | undefined): JourneyEnd {
  const airport = getAirport(code)!;
  return { kind: "airport", airport: code, terminal: airport.terminals.length > 1 ? terminal : airport.terminals[0]?.id };
}

const coordinates = (end: JourneyEnd): LatLng => (end.kind === "airport" ? getAirport(end.airport)! : end.address);

export async function createQuote(
  input: JourneyInput,
  services: Pick<Services, "locations" | "distance">,
  { now = new Date(), fares, area = serviceArea }: Options = {},
): Promise<QuoteResult> {
  const tripType = input.tripType ?? "one_way";
  const invalid = validateJourney(input, now);
  if (invalid.length) return { ok: false, status: 422, errors: invalid };
  const ret = tripType === "return" ? input.returnJourney! : undefined;

  // Every address end and stop, with the field its errors belong to. Airports need no lookup.
  const lookups: { field: string; detail: AddressDetail; role: "end" | "stop" }[] = [];
  const addEnd = (field: string, end: JourneyEndInput) => {
    if (end.kind === "address") lookups.push({ field, detail: end, role: "end" });
  };
  addEnd("pickup", input.pickup);
  addEnd("dropoff", input.dropoff);
  input.extraStops.forEach((detail, i) => lookups.push({ field: `extraStops.${i}`, detail, role: "stop" }));
  if (ret) {
    addEnd("returnJourney.pickup", ret.pickup);
    ret.extraStops.forEach((detail, i) => lookups.push({ field: `returnJourney.extraStops.${i}`, detail, role: "stop" }));
  }

  let resolved: (ResolvedLocation | null)[];
  try {
    resolved = await Promise.all(lookups.map((l) => services.locations.resolve(l.detail.locationId)));
  } catch (err) {
    if (err instanceof LocationLookupError) {
      console.error("[quote] location lookup failed", err);
      return { ok: false, status: 502, errors: [fieldError(lookups[0]?.field ?? "pickup", "LOCATION_LOOKUP_FAILED")] };
    }
    throw err;
  }

  // Every address end and every stop must be found and inside the service area. Airports are exceptions.
  const errors: FieldError[] = [];
  const found = new Map<string, PricedAddress>();
  lookups.forEach(({ field, detail }, i) => {
    const loc = resolved[i];
    if (!loc) errors.push(fieldError(field, "ADDRESS_REQUIRED"));
    else if (!isInServiceArea(loc, area)) errors.push(fieldError(field, "ADDRESS_OUTSIDE_AREA"));
    else found.set(field, { ...loc, line1: lineOf(detail) });
  });
  if (errors.length) return { ok: false, status: 422, errors };

  const endFor = (field: string, end: JourneyEndInput): JourneyEnd =>
    end.kind === "airport" ? airportEnd(end.airport, end.terminal) : { kind: "address", address: found.get(field)! };
  const pickup = endFor("pickup", input.pickup);
  const dropoff = endFor("dropoff", input.dropoff);
  const extraStops = input.extraStops.map((_, i) => found.get(`extraStops.${i}`)!);
  const returnPickup = ret && endFor("returnJourney.pickup", ret.pickup);
  const returnStops = ret ? ret.extraStops.map((_, i) => found.get(`returnJourney.extraStops.${i}`)!) : [];

  // The same place twice on a leg, now that postcodes are known (different search results can share one).
  const placeOf = (end: JourneyEnd | undefined) => (end?.kind === "address" ? end.address : undefined);
  const legErrors = (prefix: string, start: JourneyEnd, stops: PricedAddress[], finish: JourneyEnd, endField: string) => {
    const [from, to] = [placeOf(start), placeOf(finish)];
    if (from && to && samePlace(from, to)) errors.push(fieldError(endField, "SAME_LOCATION"));
    stops.forEach((stop, i) => {
      const field = `${prefix}.${i}`;
      if ([from, to].some((p) => p && samePlace(p, stop))) errors.push(fieldError(field, "STOP_SAME_LOCATION"));
      else if (stops.slice(0, i).some((other) => samePlace(other, stop))) errors.push(fieldError(field, "STOP_DUPLICATE"));
    });
  };
  legErrors("extraStops", pickup, extraStops, dropoff, "dropoff");
  // The way back runs from its pickup to the outward pickup.
  if (ret) legErrors("returnJourney.extraStops", returnPickup!, returnStops, pickup, "returnJourney.pickup");
  if (errors.length) return { ok: false, status: 422, errors };

  // Shown to the customer as "about N miles"; it plays no part in the price.
  const distanceMiles = await services.distance.routeMiles([coordinates(pickup), ...extraStops, coordinates(dropoff)]);

  let returnJourney: PricedReturnJourney | undefined;
  if (ret) {
    returnJourney = {
      pickup: returnPickup!,
      extraStops: returnStops,
      date: ret.date,
      time: ret.time,
      pickupAtUtc: londonToUtc(ret.date, ret.time).toISOString(),
      // A flight number belongs only to a leg that starts or ends at an airport.
      flightNumber: returnPickup!.kind === "airport" || pickup.kind === "airport" ? flightOf(ret.flightNumber) : undefined,
    };
  }

  const passengers = input.passengers!;
  const journey: PricedJourney = {
    pickup,
    dropoff,
    tripType,
    extraStops,
    date: input.date,
    time: input.time,
    pickupAtUtc: londonToUtc(input.date, input.time).toISOString(),
    passengers,
    // Old luggage counts are no longer collected; the category below is what the price depends on.
    luggage: { large: 0, small: 0 },
    flightNumber: pickup.kind === "airport" || dropoff.kind === "airport" ? flightOf(input.flightNumber) : undefined,
    distanceMiles,
    returnJourney,
    luggageCategory: input.luggageCategory,
    // Only meaningful alongside suitcases; dropped otherwise so it can't contradict the category.
    handLuggageToo: input.luggageCategory === "suitcases" && input.handLuggageToo === true ? true : undefined,
    largeItems: input.largeItems,
    extras: effectiveExtras({ pickup, returnJourney }, input.extras ?? NO_EXTRAS),
  };

  const fareData = fares ?? currentReferenceFares(now);
  const options: QuoteOption[] = fleet.map((vehicle) => {
    // The fleet's luggage figures are unconfirmed and never used: only an owner-confirmed fare decides fit.
    const { pricing, lines, total } = priceVehicle(journey, vehicle.id, journey.extras, fareData, now);
    const priced = pricing.status === "priced";
    return {
      vehicleId: vehicle.id,
      available: priced,
      unavailableReason: priced ? undefined : "Price on request",
      lines,
      total,
      pricing,
    };
  });

  // The quote is held for the usual time, or until the soonest fare it uses stops being valid.
  const holdUntil = now.getTime() + bookingRules.quoteValidityMinutes * 60_000;
  const fareLimits = options.flatMap((o) => (o.pricing.status === "priced" ? [Date.parse(o.pricing.validUntil)] : []));
  const quote: Quote = {
    journey,
    options,
    pricingVersion: referenceFareRules.pricingVersion,
    issuedAt: now.toISOString(),
    expiresAt: new Date(Math.min(holdUntil, ...fareLimits)).toISOString(),
  };
  return { ok: true, quote, token: signQuote(quote) };
}
