/**
 * Business-rule validation shared by the calculator (instant feedback) and the
 * API (authoritative). Pure functions: no network, no framework imports.
 */
import { bookingRules } from "@/config/booking-rules";
import { fleet } from "@/config/fleet";
import { addDays, isValidDateString, isValidTimeString, londonToUtc, londonToday } from "@/lib/utils/dates";
import { getAirport, requiresTerminal } from "./airports";
import { fitsAnyVehicle } from "./capacity";
import { fieldError } from "./errors";
import { isLuggageCategory } from "./luggage";
import type { AddOns, AddressDetail, Customer, FieldError, JourneyEndInput, JourneyInput } from "./types";

type Rules = typeof bookingRules;

export function normaliseFlightNumber(value: string): string {
  return value.toUpperCase().replace(/[\s-]+/g, "");
}

/** IATA (BA2490) or ICAO (BAW2490) airline code + 1–4 digit number + optional suffix. */
const FLIGHT_NUMBER = /^(?:[A-Z]{3}|[A-Z]{2}|[A-Z]\d|\d[A-Z])\d{1,4}[A-Z]?$/;

export function isValidFlightNumber(value: string): boolean {
  return FLIGHT_NUMBER.test(normaliseFlightNumber(value));
}

/** An end that has been filled in: an address picked from search, or a known airport. */
function endErrors(field: string, end: JourneyEndInput | undefined): FieldError[] {
  if (end?.kind === "airport") return getAirport(end.airport) ? [] : [fieldError(field, "AIRPORT_REQUIRED")];
  if (end?.kind === "address" && end.locationId) return [];
  return [fieldError(field, "ADDRESS_REQUIRED")];
}

const sameAddress = (a: JourneyEndInput | undefined, b: JourneyEndInput | undefined) =>
  a?.kind === "address" && b?.kind === "address" && Boolean(a.locationId) && a.locationId === b.locationId;

/**
 * Stops on one leg: at most the limit, each picked from search, none at the
 * leg's start or end, and none twice. Compared by search result, never by distance.
 */
function stopErrors(
  prefix: string,
  stops: AddressDetail[],
  ends: (JourneyEndInput | undefined)[],
  rules: Rules,
): FieldError[] {
  const errors: FieldError[] = [];
  if (stops.length > rules.maxExtraStops) errors.push(fieldError(prefix, "STOP_LIMIT", { max: rules.maxExtraStops }));
  stops.forEach((stop, i) => {
    const field = `${prefix}.${i}`;
    const asEnd: JourneyEndInput = { kind: "address", locationId: stop.locationId };
    if (!stop.locationId) errors.push(fieldError(field, "ADDRESS_REQUIRED"));
    else if (ends.some((e) => sameAddress(e, asEnd))) errors.push(fieldError(field, "STOP_SAME_LOCATION"));
    else if (stops.slice(0, i).some((s) => s.locationId === stop.locationId)) errors.push(fieldError(field, "STOP_DUPLICATE"));
  });
  return errors;
}

/** Terminal for an airport end at a multi-terminal airport. */
function terminalErrors(field: string, end: JourneyEndInput | undefined): FieldError[] {
  if (end?.kind !== "airport" || !requiresTerminal(end.airport)) return [];
  const airport = getAirport(end.airport)!;
  if (!end.terminal) return [fieldError(field, "TERMINAL_REQUIRED")];
  return airport.terminals.some((t) => t.id === end.terminal) ? [] : [fieldError(field, "TERMINAL_INVALID")];
}

/** A flight number is needed to collect from an airport; otherwise it's optional but must look right. */
function flightErrors(field: string, flightNumber: string | undefined, pickup: JourneyEndInput | undefined): FieldError[] {
  const flight = flightNumber?.trim();
  if (!flight) return pickup?.kind === "airport" ? [fieldError(field, "FLIGHT_NUMBER_REQUIRED")] : [];
  return isValidFlightNumber(flight) ? [] : [fieldError(field, "FLIGHT_NUMBER_INVALID")];
}

/** Pickup, drop-off and stops of the outward leg. Service-area checks need lookups and run on the server. */
export function validateJourneyStep(input: Partial<JourneyInput>, rules: Rules = bookingRules): FieldError[] {
  const { pickup, dropoff } = input;
  const errors = [...endErrors("pickup", pickup), ...endErrors("dropoff", dropoff)];
  if (pickup?.kind === "airport" && dropoff?.kind === "airport") errors.push(fieldError("dropoff", "ROUTE_UNSUPPORTED"));
  else if (sameAddress(pickup, dropoff)) errors.push(fieldError("dropoff", "SAME_LOCATION"));
  errors.push(...stopErrors("extraStops", input.extraStops ?? [], [pickup, dropoff], rules));
  return errors;
}

export function validateWhenStep(
  input: Partial<JourneyInput>,
  now: Date = new Date(),
  rules: Rules = bookingRules,
): FieldError[] {
  const errors: FieldError[] = [];
  const { date, time } = input;

  if (!date) errors.push(fieldError("date", "DATE_REQUIRED"));
  else if (!isValidDateString(date)) errors.push(fieldError("date", "DATE_INVALID"));
  else if (date < londonToday(now)) errors.push(fieldError("date", "DATE_IN_PAST"));
  else if (date > addDays(londonToday(now), rules.maxDaysAhead)) {
    errors.push(fieldError("date", "DATE_TOO_FAR", { days: rules.maxDaysAhead }));
  }

  if (!time) errors.push(fieldError("time", "TIME_REQUIRED"));
  else if (!isValidTimeString(time)) errors.push(fieldError("time", "TIME_INVALID"));

  if (errors.length === 0 && date && time) {
    const pickup = londonToUtc(date, time).getTime();
    if (pickup - now.getTime() < rules.minNoticeMinutes * 60_000) {
      errors.push(fieldError("time", "TIME_TOO_SOON", { hours: rules.minNoticeMinutes / 60 }));
    }
  }
  return errors;
}

export function validatePartyStep(input: Partial<JourneyInput>): FieldError[] {
  const errors: FieldError[] = [];
  const { passengers, luggage } = input;

  if (passengers === null || passengers === undefined) {
    errors.push(fieldError("passengers", "PASSENGERS_REQUIRED"));
  } else if (!Number.isInteger(passengers) || passengers < 1) {
    errors.push(fieldError("passengers", "PASSENGERS_INVALID"));
  }

  if (!luggage || !validCount(luggage.large) || !validCount(luggage.small)) {
    errors.push(fieldError("luggage", "LUGGAGE_INVALID"));
  }

  if (errors.length === 0 && !fitsAnyVehicle(fleet, passengers!, luggage!)) {
    errors.push(fieldError("passengers", "CAPACITY_EXCEEDED"));
  }
  return errors;
}

/** Terminals for the outward leg's airport end, and the flight number (required when collecting from an airport). */
export function validateAirportStep(input: Partial<JourneyInput>): FieldError[] {
  return [
    ...terminalErrors("pickup.terminal", input.pickup),
    ...terminalErrors("dropoff.terminal", input.dropoff),
    ...flightErrors("flightNumber", input.flightNumber, input.pickup),
  ];
}

const maxPassengers = Math.max(...fleet.map((v) => v.maxPassengers));
const validCount = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 20;

/**
 * Passengers and a luggage category (none, hand luggage or suitcases). Vehicle
 * fit is decided per fare (owner-confirmed combinations), not from the fleet's
 * luggage figures.
 */
export function validateReferencePartyStep(input: Partial<JourneyInput>): FieldError[] {
  const errors: FieldError[] = [];
  const { passengers, luggageCategory } = input;

  if (passengers === null || passengers === undefined) {
    errors.push(fieldError("passengers", "PASSENGERS_REQUIRED"));
  } else if (!Number.isInteger(passengers) || passengers < 1) {
    errors.push(fieldError("passengers", "PASSENGERS_INVALID"));
  } else if (passengers > maxPassengers) {
    errors.push(fieldError("passengers", "CAPACITY_EXCEEDED"));
  }

  if (!isLuggageCategory(luggageCategory)) errors.push(fieldError("luggageCategory", "LUGGAGE_CATEGORY_REQUIRED"));
  if (typeof input.largeItems !== "boolean") errors.push(fieldError("largeItems", "LARGE_ITEMS_REQUIRED"));
  return errors;
}

/**
 * Where the way back can start. The return always ends at the outward pickup.
 * Its pickup may be another address, or another terminal at the airport the
 * outward journey went to — never a different airport, and never an airport
 * when the outward journey ended at an address.
 */
function returnPickupErrors(input: Partial<JourneyInput>, pickup: JourneyEndInput): FieldError[] {
  const field = "returnJourney.pickup";
  if (pickup.kind === "airport") {
    const outward = input.dropoff;
    return outward?.kind === "airport" && outward.airport === pickup.airport ? [] : [fieldError(field, "RETURN_PICKUP_INVALID")];
  }
  return sameAddress(pickup, input.pickup) ? [fieldError(field, "SAME_LOCATION")] : [];
}

/** Checks for the way back of a return booking that don't need any lookups. */
export function validateReturnJourney(
  input: Partial<JourneyInput>,
  now: Date = new Date(),
  rules: Rules = bookingRules,
): FieldError[] {
  const r = input.returnJourney;
  if (!r) return [fieldError("returnJourney", "RETURN_JOURNEY_REQUIRED")];
  const prefix = (e: FieldError) => ({ ...e, field: `returnJourney.${e.field}` });
  const errors = validateWhenStep({ date: r.date, time: r.time }, now, rules).map(prefix);

  const pickupProblems = endErrors("returnJourney.pickup", r.pickup);
  errors.push(...pickupProblems);
  if (!pickupProblems.length) errors.push(...returnPickupErrors(input, r.pickup));
  // The way back runs from its pickup to the outward pickup.
  errors.push(...stopErrors("returnJourney.extraStops", r.extraStops ?? [], [r.pickup, input.pickup], rules));
  errors.push(...terminalErrors("returnJourney.pickup.terminal", r.pickup));
  errors.push(...flightErrors("returnJourney.flightNumber", r.flightNumber, r.pickup));

  const timesValid =
    input.date && input.time && isValidDateString(input.date) && isValidTimeString(input.time) &&
    isValidDateString(r.date) && isValidTimeString(r.time);
  if (timesValid && londonToUtc(r.date, r.time) <= londonToUtc(input.date!, input.time!)) {
    errors.push(fieldError("returnJourney.date", "RETURN_BEFORE_OUTBOUND"));
  }
  return errors;
}

/** Full journey validation, run by the quote API. */
export function validateJourney(input: Partial<JourneyInput>, now: Date = new Date()): FieldError[] {
  return [
    ...validateJourneyStep(input),
    ...validateWhenStep(input, now),
    // Always the luggage category: no fallback to old luggage counts or the fleet's unconfirmed limits.
    ...validateReferencePartyStep(input),
    ...validateAirportStep(input),
    ...(input.tripType === "return" ? validateReturnJourney(input, now) : []),
  ];
}

export interface BookingDetailsInput {
  customer: Customer;
  /** House number and street for every address end of the journey, keyed by request field. */
  addressLines: { field: string; value?: string }[];
  addOns: AddOns;
  specialRequirements?: string;
  notes?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;

export function validateBookingDetails(
  input: BookingDetailsInput,
  rules: Rules = bookingRules,
): FieldError[] {
  const errors: FieldError[] = [];
  const { customer, addOns } = input;

  if (!customer.name?.trim()) errors.push(fieldError("customer.name", "NAME_REQUIRED"));
  else if (customer.name.length > 100) errors.push(fieldError("customer.name", "TEXT_TOO_LONG", { max: 100 }));
  if (!EMAIL.test(customer.email?.trim() ?? "")) errors.push(fieldError("customer.email", "EMAIL_INVALID"));
  const digits = (customer.phone ?? "").replace(/\D/g, "");
  if (!PHONE.test(customer.phone?.trim() ?? "") || digits.length < 7 || digits.length > 15) {
    errors.push(fieldError("customer.phone", "PHONE_INVALID"));
  }

  for (const { field, value } of input.addressLines) {
    if (!value?.trim()) errors.push(fieldError(field, "ADDRESS_LINE_REQUIRED"));
    else if (value.length > 120) errors.push(fieldError(field, "TEXT_TOO_LONG", { max: 120 }));
  }

  if (!Number.isInteger(addOns.childSeats) || addOns.childSeats < 0 || addOns.childSeats > rules.maxChildSeats) {
    errors.push(fieldError("addOns.childSeats", "CHILD_SEATS_INVALID", { max: rules.maxChildSeats }));
  }
  if ((input.specialRequirements?.length ?? 0) > 500) {
    errors.push(fieldError("specialRequirements", "TEXT_TOO_LONG", { max: 500 }));
  }
  if ((input.notes?.length ?? 0) > 1000) errors.push(fieldError("notes", "TEXT_TOO_LONG", { max: 1000 }));
  return errors;
}
