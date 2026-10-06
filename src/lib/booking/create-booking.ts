import { randomInt } from "node:crypto";
import { pricing, type PricingConfig } from "@/config/pricing";
import { serviceArea, type ServiceAreaConfig } from "@/config/service-area";
import { fieldError } from "@/lib/domain/errors";
import { haversineMiles, isInServiceArea, normalisePostcode } from "@/lib/domain/geo";
import type { AddOns, Booking, Customer, FieldError, PricedJourney, VehicleId } from "@/lib/domain/types";
import { validateBookingDetails, validateWhenStep } from "@/lib/domain/validation";
import { price } from "@/lib/pricing/engine";
import { verifyQuote } from "@/lib/quote/token";
import type { Services } from "@/lib/services";
import { LocationLookupError } from "@/lib/services/location/types";
import type { Pence } from "@/lib/utils/money";

export interface BookingRequest {
  quoteToken: string;
  vehicleId: VehicleId;
  addOns: AddOns;
  customer: Customer;
  addressLine1: string;
  addressPostcode?: string;
  specialRequirements?: string;
  notes?: string;
  /** The total the customer saw; the booking is refused if the server disagrees. */
  expectedTotal: Pence;
}

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; status: 400 | 409 | 422 | 502; errors: FieldError[]; total?: Pence };

/** Unambiguous characters only (no 0/O, 1/I/L). */
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const POSTCODE_MATCH_MILES = 5;

function newReference(): string {
  let ref = "GAT-";
  for (let i = 0; i < 6; i++) ref += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return ref;
}

interface Options {
  now?: Date;
  config?: PricingConfig;
  area?: ServiceAreaConfig;
}

export async function createBooking(
  req: BookingRequest,
  services: Services,
  { now = new Date(), config = pricing, area = serviceArea }: Options = {},
): Promise<BookingResult> {
  const quote = verifyQuote(req.quoteToken);
  if (!quote) return { ok: false, status: 400, errors: [fieldError("quote", "QUOTE_INVALID")] };
  if (new Date(quote.expiresAt) < now || quote.pricingVersion !== config.version) {
    return { ok: false, status: 409, errors: [fieldError("quote", "QUOTE_EXPIRED")] };
  }

  // The quote may be up to 30 minutes old: re-check the notice period.
  const timing = validateWhenStep({ date: quote.journey.date, time: quote.journey.time }, now);
  if (timing.length) return { ok: false, status: 422, errors: timing };

  const needsPostcode = quote.journey.address.kind === "place";
  const errors = validateBookingDetails({ ...req, needsPostcode });

  const option = quote.options.find((o) => o.vehicleId === req.vehicleId);
  if (!option) errors.push(fieldError("vehicleId", "VEHICLE_REQUIRED"));
  else if (!option.available) errors.push(fieldError("vehicleId", "VEHICLE_UNAVAILABLE"));
  if (errors.length) return { ok: false, status: 422, errors };

  const address: PricedJourney["address"] = { ...quote.journey.address, line1: req.addressLine1.trim() };
  if (needsPostcode) {
    try {
      const pc = await services.locations.lookupPostcode(normalisePostcode(req.addressPostcode!)!);
      if (!pc) return { ok: false, status: 422, errors: [fieldError("addressPostcode", "POSTCODE_INVALID")] };
      if (!isInServiceArea(pc, area)) {
        return { ok: false, status: 422, errors: [fieldError("addressPostcode", "ADDRESS_OUTSIDE_AREA")] };
      }
      if (haversineMiles(pc, quote.journey.address) > POSTCODE_MATCH_MILES) {
        return { ok: false, status: 422, errors: [fieldError("addressPostcode", "POSTCODE_MISMATCH")] };
      }
      address.postcode = pc.postcode;
      address.outcode = pc.outcode;
    } catch (err) {
      if (!(err instanceof LocationLookupError)) throw err;
      return { ok: false, status: 502, errors: [fieldError("addressPostcode", "LOCATION_LOOKUP_FAILED")] };
    }
  }

  const journey: PricedJourney = { ...quote.journey, address };
  const { lines, total } = price(
    {
      direction: journey.direction,
      airport: journey.airport,
      vehicleId: req.vehicleId,
      distanceMiles: journey.distanceMiles,
      time: journey.time,
      extraStops: journey.extraStops.length,
      addOns: req.addOns,
    },
    config,
  );
  if (total !== req.expectedTotal) {
    return { ok: false, status: 409, errors: [fieldError("total", "PRICE_CHANGED")], total };
  }

  let reference = newReference();
  while (await services.bookings.exists(reference)) reference = newReference();

  const draft: Omit<Booking, "payment"> = {
    reference,
    status: "received",
    journey,
    vehicleId: req.vehicleId,
    addOns: {
      meetAndGreet: journey.direction === "from_airport" && req.addOns.meetAndGreet,
      childSeats: req.addOns.childSeats,
    },
    lines,
    total,
    pricingVersion: quote.pricingVersion,
    customer: {
      name: req.customer.name.trim(),
      email: req.customer.email.trim(),
      phone: req.customer.phone.trim(),
    },
    specialRequirements: req.specialRequirements?.trim() || undefined,
    notes: req.notes?.trim() || undefined,
    flightCheck: journey.flightNumber
      ? await services.flights.check(journey.flightNumber, journey.date, journey.airport)
      : { status: "unverified" },
    createdAt: now.toISOString(),
  };
  const booking: Booking = { ...draft, payment: await services.payments.initialise(draft) };
  await services.bookings.create(booking);

  // A notification failure must never lose a booking that has been saved.
  try {
    await services.notifier.bookingReceived(booking);
  } catch (err) {
    console.error(`[booking ${reference}] notification failed`, err);
  }
  return { ok: true, booking };
}
