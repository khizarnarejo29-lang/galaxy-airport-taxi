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
import { normalisePostcode } from "./geo";
import type { AddOns, Customer, FieldError, JourneyInput } from "./types";

type Rules = typeof bookingRules;

export function normaliseFlightNumber(value: string): string {
  return value.toUpperCase().replace(/[\s-]+/g, "");
}

/** IATA (BA2490) or ICAO (BAW2490) airline code + 1–4 digit number + optional suffix. */
const FLIGHT_NUMBER = /^(?:[A-Z]{3}|[A-Z]{2}|[A-Z]\d|\d[A-Z])\d{1,4}[A-Z]?$/;

export function isValidFlightNumber(value: string): boolean {
  return FLIGHT_NUMBER.test(normaliseFlightNumber(value));
}

export function validateJourneyStep(input: Partial<JourneyInput>, rules: Rules = bookingRules): FieldError[] {
  const errors: FieldError[] = [];
  if (input.direction !== "to_airport" && input.direction !== "from_airport") {
    errors.push(fieldError("direction", "DIRECTION_REQUIRED"));
  }
  if (!input.airport || !getAirport(input.airport)) {
    errors.push(fieldError("airport", "AIRPORT_REQUIRED"));
  }
  if (!input.address?.locationId) {
    errors.push(fieldError("address", "ADDRESS_REQUIRED"));
  }
  const stops = input.extraStops ?? [];
  if (stops.length > rules.maxExtraStops) {
    errors.push(fieldError("extraStops", "STOP_LIMIT", { max: rules.maxExtraStops }));
  }
  stops.forEach((stop, i) => {
    if (!stop.locationId) errors.push(fieldError(`extraStops.${i}`, "ADDRESS_REQUIRED"));
  });
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

  const validCount = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 20;
  if (!luggage || !validCount(luggage.large) || !validCount(luggage.small)) {
    errors.push(fieldError("luggage", "LUGGAGE_INVALID"));
  }

  if (errors.length === 0 && !fitsAnyVehicle(fleet, passengers!, luggage!)) {
    errors.push(fieldError("passengers", "CAPACITY_EXCEEDED"));
  }
  return errors;
}

export function validateAirportStep(input: Partial<JourneyInput>): FieldError[] {
  const errors: FieldError[] = [];
  const airport = input.airport ? getAirport(input.airport) : undefined;

  if (airport && requiresTerminal(airport.code)) {
    if (!input.terminal) errors.push(fieldError("terminal", "TERMINAL_REQUIRED"));
    else if (!airport.terminals.some((t) => t.id === input.terminal)) {
      errors.push(fieldError("terminal", "TERMINAL_INVALID"));
    }
  }

  const flight = input.flightNumber?.trim();
  if (!flight) {
    if (input.direction === "from_airport") errors.push(fieldError("flightNumber", "FLIGHT_NUMBER_REQUIRED"));
  } else if (!isValidFlightNumber(flight)) {
    errors.push(fieldError("flightNumber", "FLIGHT_NUMBER_INVALID"));
  }
  return errors;
}

/** Full journey validation, run by the quote API. */
export function validateJourney(input: Partial<JourneyInput>, now: Date = new Date()): FieldError[] {
  return [
    ...validateJourneyStep(input),
    ...validateWhenStep(input, now),
    ...validatePartyStep(input),
    ...validateAirportStep(input),
  ];
}

export interface BookingDetailsInput {
  customer: Customer;
  addressLine1?: string;
  addressPostcode?: string;
  /** True when the chosen location is a named area rather than a full postcode. */
  needsPostcode: boolean;
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

  if (!input.addressLine1?.trim()) errors.push(fieldError("addressLine1", "ADDRESS_LINE_REQUIRED"));
  else if (input.addressLine1.length > 120) {
    errors.push(fieldError("addressLine1", "TEXT_TOO_LONG", { max: 120 }));
  }
  if (input.needsPostcode) {
    if (!input.addressPostcode?.trim()) errors.push(fieldError("addressPostcode", "POSTCODE_REQUIRED"));
    else if (!normalisePostcode(input.addressPostcode)) {
      errors.push(fieldError("addressPostcode", "POSTCODE_INVALID"));
    }
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
