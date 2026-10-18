import { randomInt } from "node:crypto";
import { activeTariff, type PricingConfig } from "@/config/pricing";
import { referenceFareRules } from "@/config/reference-vehicles";
import { fieldError } from "@/lib/domain/errors";
import { journeyAirport } from "@/lib/domain/route";
import type { AddOns, Booking, Customer, FieldError, JourneyEnd, PricedJourney, VehicleId } from "@/lib/domain/types";
import { validateBookingDetails, validateWhenStep } from "@/lib/domain/validation";
import { currentReferenceFares, type ReferenceFare } from "@/lib/reference-fares";
import { effectiveExtras, priceVehicle } from "@/lib/reference-fares/journey-pricing";
import { verifyQuote } from "@/lib/quote/token";
import type { Services } from "@/lib/services";
import { BookingReferenceTakenError, BookingStorageError } from "@/lib/services/bookings";
import type { Pence } from "@/lib/utils/money";

export interface BookingRequest {
  quoteToken: string;
  vehicleId: VehicleId;
  addOns: AddOns;
  customer: Customer;
  /** House number and street for the pickup, when it's an address. */
  pickupLine1?: string;
  /** House number and street for the drop-off, when it's an address. */
  dropoffLine1?: string;
  /** For a return collected from another address. Defaults to `dropoffLine1` when it's the outward drop-off. */
  returnPickupLine1?: string;
  specialRequirements?: string;
  notes?: string;
  /** The total the customer saw; the booking is refused if the server disagrees. Never used as the price. */
  expectedTotal: Pence;
}

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; status: 400 | 409 | 422 | 502 | 503; errors: FieldError[]; total?: Pence };

/** A new reference is tried this many times if it clashes with an existing booking. */
const MAX_REFERENCE_ATTEMPTS = 5;

/** The booking could not be saved: refuse it and ask the customer to call. Logs no customer details. */
function notSaved(err: unknown): BookingResult {
  const code = err instanceof BookingStorageError ? (err.code ?? err.message) : err instanceof Error ? err.name : "unknown";
  console.error(`[booking] not saved (${code}); customer asked to call`);
  return { ok: false, status: 503, errors: [fieldError("request", "BOOKING_UNAVAILABLE")] };
}

/** Unambiguous characters only (no 0/O, 1/I/L). */
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function newReference(): string {
  let ref = "GAT-";
  for (let i = 0; i < 6; i++) ref += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return ref;
}

interface Options {
  now?: Date;
  /** Reference fares to re-check against; defaults to the stored, validated fare data. */
  fares?: readonly ReferenceFare[];
  /** Location tariff to re-check against; defaults to the active one. */
  tariff?: PricingConfig | null;
}

const sameAddOns = (a: AddOns, b: AddOns) => a.meetAndGreet === b.meetAndGreet && a.childSeats === b.childSeats;

const sameAddressEnd = (a: JourneyEnd, b: JourneyEnd) =>
  a.kind === "address" && b.kind === "address" && a.address.id === b.address.id;

/** An address end with the customer's house number and street. Airports are unchanged. */
const withLine = (end: JourneyEnd, line1: string | undefined): JourneyEnd =>
  end.kind === "address" ? { kind: "address", address: { ...end.address, line1: line1?.trim() || end.address.line1 } } : end;

export async function createBooking(
  req: BookingRequest,
  services: Services,
  { now = new Date(), fares, tariff = activeTariff() }: Options = {},
): Promise<BookingResult> {
  const quote = verifyQuote(req.quoteToken);
  if (!quote) return { ok: false, status: 400, errors: [fieldError("quote", "QUOTE_INVALID")] };
  if (new Date(quote.expiresAt) <= now || quote.pricingVersion !== referenceFareRules.pricingVersion) {
    return { ok: false, status: 409, errors: [fieldError("quote", "QUOTE_EXPIRED")] };
  }

  // The quote may be up to 30 minutes old: re-check the notice period for every pickup.
  const timing = validateWhenStep({ date: quote.journey.date, time: quote.journey.time }, now);
  if (timing.length) return { ok: false, status: 422, errors: timing };
  const ret = quote.journey.returnJourney;
  if (ret) {
    const back = validateWhenStep({ date: ret.date, time: ret.time }, now);
    if (back.length) return { ok: false, status: 422, errors: back.map((e) => ({ ...e, field: `returnJourney.${e.field}` })) };
  }

  // Every address end needs a house number and street for the driver. A return collected from the
  // outward drop-off reuses that address; one collected elsewhere needs its own.
  const { pickup, dropoff } = quote.journey;
  const returnFromDropoff = Boolean(ret && sameAddressEnd(ret.pickup, dropoff));
  const addressLines = [
    ...(pickup.kind === "address" ? [{ field: "pickupLine1", value: req.pickupLine1 }] : []),
    ...(dropoff.kind === "address" ? [{ field: "dropoffLine1", value: req.dropoffLine1 }] : []),
    ...(ret?.pickup.kind === "address" && !returnFromDropoff ? [{ field: "returnPickupLine1", value: req.returnPickupLine1 }] : []),
  ];
  const errors = validateBookingDetails({ ...req, addressLines });

  const option = quote.options.find((o) => o.vehicleId === req.vehicleId);
  if (!option) errors.push(fieldError("vehicleId", "VEHICLE_REQUIRED"));
  else if (!option.available) errors.push(fieldError("vehicleId", "VEHICLE_UNAVAILABLE"));
  if (errors.length) return { ok: false, status: 422, errors };

  // The house details are priced too: the re-check below matches them against the stored fare.
  const journey: PricedJourney = {
    ...quote.journey,
    pickup: withLine(pickup, req.pickupLine1),
    dropoff: withLine(dropoff, req.dropoffLine1),
    returnJourney: ret && {
      ...ret,
      pickup: withLine(ret.pickup, returnFromDropoff ? req.dropoffLine1 : req.returnPickupLine1),
    },
  };

  // Extras are part of the matched fare, so they must be the ones the price was quoted with.
  const extras = effectiveExtras(journey, req.addOns);
  const quoted = option!.pricing;
  if (!sameAddOns(extras, journey.extras)) {
    return { ok: false, status: 409, errors: [fieldError("addOns", "PRICE_CHANGED")] };
  }

  // Re-run the match now, with the full address, against the fare data as it is now.
  const current = priceVehicle(journey, req.vehicleId, extras, fares ?? currentReferenceFares(now), now, tariff);
  if (current.pricing.status === "price_on_request") {
    console.warn(`[booking] fare no longer available (${current.pricing.reason})`);
    return { ok: false, status: 409, errors: [fieldError("quote", "FARE_UNAVAILABLE")] };
  }
  const p = current.pricing;
  // The same source must still give the same total: the same reference fare, or the same tariff version.
  const samePricing =
    p.status === "priced"
      ? quoted.status === "priced" && quoted.fareId === p.fareId && quoted.referenceTotal === p.referenceTotal && quoted.checkedAt === p.checkedAt
      : quoted.status === "tariff" && quoted.tariffVersion === p.tariffVersion;
  const sameFare = samePricing && option!.total === current.total;
  if (!sameFare || current.total !== req.expectedTotal) {
    return { ok: false, status: 409, errors: [fieldError("total", "PRICE_CHANGED")], total: current.total };
  }

  const airport = journeyAirport(journey);
  const flightCheck: Booking["flightCheck"] =
    journey.flightNumber && airport
      ? await services.flights.check(journey.flightNumber, journey.date, airport)
      : { status: "unverified" };

  // Save it. A clash on the reference picks a new one; any other storage problem refuses the
  // booking — it is never reported as made unless it has actually been saved.
  let booking: Booking | undefined;
  for (let attempt = 1; attempt <= MAX_REFERENCE_ATTEMPTS && !booking; attempt++) {
    const draft: Omit<Booking, "payment"> = {
      reference: newReference(),
      status: "received",
      journey,
      vehicleId: req.vehicleId,
      addOns: extras,
      lines: current.lines,
      total: current.total,
      pricingVersion: quote.pricingVersion,
      referenceFare: p.status === "priced" ? { id: p.fareId, referenceTotal: p.referenceTotal, checkedAt: p.checkedAt } : undefined,
      tariff: p.status === "tariff" ? { version: p.tariffVersion, events: p.events } : undefined,
      reviewFlags: p.status === "priced" && p.flags.length ? p.flags : undefined,
      customer: {
        name: req.customer.name.trim(),
        email: req.customer.email.trim(),
        phone: req.customer.phone.trim(),
      },
      specialRequirements: req.specialRequirements?.trim() || undefined,
      notes: req.notes?.trim() || undefined,
      flightCheck,
      createdAt: now.toISOString(),
    };
    const candidate: Booking = { ...draft, payment: await services.payments.initialise(draft) };
    try {
      await services.bookings.create(candidate);
      booking = candidate;
    } catch (err) {
      if (err instanceof BookingReferenceTakenError) continue;
      return notSaved(err);
    }
  }
  if (!booking) return notSaved(new BookingReferenceTakenError());
  const { reference } = booking;

  // A notification failure must never lose a booking that has been saved.
  try {
    await services.notifier.bookingReceived(booking);
  } catch (err) {
    console.error(`[booking ${reference}] notification failed`, err);
  }
  return { ok: true, booking };
}
