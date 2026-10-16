/**
 * Exact matching of a customer's journey against stored reference fares.
 * Pure and framework-free. A price is returned only when one approved,
 * in-date fare matches every option; anything else is "price on request".
 */
import {
  excludedReferenceVehicles,
  holidayWindows,
  referenceFareRules,
  vehicleMapping,
} from "@/config/reference-vehicles";
import { normalisePostcode } from "@/lib/domain/geo";
import type { AirportCode, VehicleId } from "@/lib/domain/types";
import type { Pence } from "@/lib/utils/money";
import { normaliseAddressLine, type FareEnd, type ReferenceFare, type ReferenceParty } from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface QueryAddress {
  postcode: string;
  /** House number and street, when the customer has given it. */
  line1?: string;
}

export interface QueryAirport {
  airport: AirportCode;
  terminal: string | null;
}

/** One end of a leg, in the same terms as a stored fare. */
export type QueryEnd = ({ kind: "address" } & QueryAddress) | ({ kind: "airport" } & QueryAirport);

export interface FareQuery {
  vehicleId: VehicleId;
  tripType: "one_way" | "return";
  pickup: QueryEnd;
  dropoff: QueryEnd;
  /** Stop postcodes on the outbound leg, in order. */
  stops: string[];
  /** London local date (YYYY-MM-DD) and time (HH:mm) of the outbound pickup. */
  date: string;
  time: string;
  /** The way back. It always ends at the outward pickup, so only its pickup and stops are compared. */
  returnLeg?: {
    pickup: QueryEnd;
    stops: string[];
    date: string;
    time: string;
    /** Only when the return leg differs from the booking-level values; any difference is never priced. */
    party?: QueryParty;
    extras?: QueryExtras;
  };
  /** Passengers and luggage for the whole booking (both legs of a return). */
  party: QueryParty;
  /** Extras for the whole booking (both legs of a return). */
  extras: QueryExtras;
}

/** Passenger count and luggage category (none, hand luggage or suitcases). */
export type QueryParty = ReferenceParty;

export interface QueryExtras {
  meetAndGreet: boolean;
  childSeats: number;
}

/** A priced match that the owner should still look at. */
export type ReviewFlag = "ADDRESS_DETAIL_NOT_GIVEN";

/** Why no price can be shown, from least to most specific. */
export const unmatchedReasons = [
  "NO_VEHICLE_MAPPING",
  "HOLIDAY_DATE",
  "RETURN_LEG_DIFFERS",
  "NO_MATCHING_FARE",
  "ADDRESS_MISMATCH",
  "RETURN_ROUTE_UNCONFIRMED",
  "RETURN_ROUTE_MISMATCH",
  "STOPS_MISMATCH",
  "EXTRAS_MISMATCH",
  "PARTY_UNCONFIRMED",
  "TRAVEL_DATE_UNVERIFIED",
  "NOT_APPROVED",
  "INVALID_ENTRY",
  "EXPIRED",
  "AMBIGUOUS",
] as const;

export type UnmatchedReason = (typeof unmatchedReasons)[number];

export type FareMatch =
  | {
      status: "matched";
      fare: ReferenceFare;
      referenceTotal: Pence;
      galaxyTotal: Pence;
      /** The fare can't be used at or after this instant. */
      validUntil: string;
      flags: ReviewFlag[];
    }
  | { status: "price_on_request"; reason: UnmatchedReason };

/** The single deduction, applied once to the whole booking total. */
export function galaxyFareFromReference(referenceTotal: Pence): Pence {
  if (!Number.isInteger(referenceTotal) || referenceTotal <= referenceFareRules.discountPence) {
    throw new RangeError("Reference total must be a whole number of pence above the discount");
  }
  return referenceTotal - referenceFareRules.discountPence;
}

export function fareValidUntil(fare: Pick<ReferenceFare, "checkedAt">): Date {
  return new Date(Date.parse(fare.checkedAt) + referenceFareRules.validForDays * DAY_MS);
}

export function isFareFresh(fare: Pick<ReferenceFare, "checkedAt">, now: Date): boolean {
  const checked = Date.parse(fare.checkedAt);
  return checked <= now.getTime() && now.getTime() < fareValidUntil(fare).getTime();
}

export function isFareApproved(fare: ReferenceFare): boolean {
  return fare.status === "approved" && fare.approvedBy.trim() !== "" && fare.approvedAt !== null;
}

/** True when a London local date/time falls in a published surcharge window. */
export function inHolidayWindow(date: string, time: string): boolean {
  const at = `${date.slice(5)} ${time}`;
  return holidayWindows.some(({ from, to }) => {
    const start = `${from.date} ${from.time}`;
    const end = `${to.date} ${to.time}`;
    return start <= end ? at >= start && at <= end : at >= start || at <= end;
  });
}

const samePostcode = (a: string, b: string) => {
  const na = normalisePostcode(a);
  return na !== null && na === normalisePostcode(b);
};

/** Same kind of end, and the same postcode or the same airport and terminal. House details are compared separately. */
const sameEnd = (q: QueryEnd, f: FareEnd) =>
  q.kind === "address"
    ? f.kind === "address" && samePostcode(q.postcode, f.postcode)
    : f.kind === "airport" && q.airport === f.airport && q.terminal === f.terminal;

const sameStops = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => samePostcode(s, b[i]));

/** Exact match only: a fare confirmed for 2 passengers with suitcases says nothing about 3, or about hand luggage. */
const sameParty = (a: ReferenceParty, b: ReferenceParty) => a.passengers === b.passengers && a.luggage === b.luggage;

const sameExtras = (a: QueryExtras, b: QueryExtras) => a.meetAndGreet === b.meetAndGreet && a.childSeats === b.childSeats;

const hasLine = (a: QueryAddress) => Boolean(a.line1?.trim());

/** Supplied house details must equal the stored ones; missing details are allowed (and flagged). */
const lineConflicts = (given: QueryEnd, stored: FareEnd) =>
  given.kind === "address" &&
  stored.kind === "address" &&
  hasLine(given) &&
  normaliseAddressLine(given.line1!) !== normaliseAddressLine(stored.line1);

/** An address end without house details. */
const missingLine = (end: QueryEnd | undefined) => end?.kind === "address" && !hasLine(end);

/** The reference price was verified for exactly these travel dates. */
const dateVerified = (q: FareQuery, f: ReferenceFare) =>
  f.verifiedTravelDates.some(
    (d) => d.outbound === q.date && (q.tripType === "one_way" ? !d.return : d.return === q.returnLeg?.date),
  );

type Check = { ok: true } | { ok: false; reason: UnmatchedReason };
const fail = (reason: UnmatchedReason): Check => ({ ok: false, reason });

/** The first check this fare fails for the query, or ok. */
function checkFare(q: FareQuery, f: ReferenceFare, now: Date): Check {
  if (
    f.referenceVehicle !== vehicleMapping[q.vehicleId] ||
    f.tripType !== q.tripType ||
    !sameEnd(q.pickup, f.pickup) ||
    !sameEnd(q.dropoff, f.dropoff)
  ) {
    return fail("NO_MATCHING_FARE");
  }
  if (lineConflicts(q.pickup, f.pickup) || lineConflicts(q.dropoff, f.dropoff)) return fail("ADDRESS_MISMATCH");

  if (q.tripType === "return") {
    if (f.returnLeg?.status !== "confirmed") return fail("RETURN_ROUTE_UNCONFIRMED");
    const r = q.returnLeg;
    if (!r || !sameEnd(r.pickup, f.returnLeg.pickup) || !sameStops(r.stops, f.returnLeg.stops)) {
      return fail("RETURN_ROUTE_MISMATCH");
    }
    if (lineConflicts(r.pickup, f.returnLeg.pickup)) return fail("ADDRESS_MISMATCH");
  }

  if (!sameStops(q.stops, f.stops)) return fail("STOPS_MISMATCH");
  if (!sameExtras(q.extras, f.extras)) return fail("EXTRAS_MISMATCH");
  if (!f.confirmedParties.some((p) => sameParty(p, q.party))) return fail("PARTY_UNCONFIRMED");
  if (!dateVerified(q, f)) return fail("TRAVEL_DATE_UNVERIFIED");
  if (!isFareApproved(f)) return fail("NOT_APPROVED");
  if (Date.parse(f.checkedAt) > now.getTime() || f.referenceTotalPence <= referenceFareRules.discountPence) {
    return fail("INVALID_ENTRY");
  }
  if (!isFareFresh(f, now)) return fail("EXPIRED");
  return { ok: true };
}

const rank = (r: UnmatchedReason) => unmatchedReasons.indexOf(r);

export function matchReferenceFare(q: FareQuery, fares: readonly ReferenceFare[], now: Date = new Date()): FareMatch {
  const mapped = vehicleMapping[q.vehicleId];
  if (!mapped || excludedReferenceVehicles.includes(mapped)) return { status: "price_on_request", reason: "NO_VEHICLE_MAPPING" };

  if (inHolidayWindow(q.date, q.time) || (q.returnLeg && inHolidayWindow(q.returnLeg.date, q.returnLeg.time))) {
    return { status: "price_on_request", reason: "HOLIDAY_DATE" };
  }
  const back = q.returnLeg;
  // Passengers, luggage and extras are stored once per booking: a return leg that differs can't be priced.
  if (
    back &&
    ((back.party && !sameParty(back.party, q.party)) ||
      (back.extras && !sameExtras(back.extras, q.extras)))
  ) {
    return { status: "price_on_request", reason: "RETURN_LEG_DIFFERS" };
  }

  const matches: ReferenceFare[] = [];
  let reason: UnmatchedReason = "NO_MATCHING_FARE";
  for (const f of fares) {
    const result = checkFare(q, f, now);
    if (result.ok) matches.push(f);
    else if (rank(result.reason) > rank(reason)) reason = result.reason;
  }

  if (matches.length > 1) return { status: "price_on_request", reason: "AMBIGUOUS" };
  if (matches.length === 0) return { status: "price_on_request", reason };

  const fare = matches[0];
  const flags: ReviewFlag[] = [];
  if ([q.pickup, q.dropoff, back?.pickup].some(missingLine)) flags.push("ADDRESS_DETAIL_NOT_GIVEN");

  return {
    status: "matched",
    fare,
    referenceTotal: fare.referenceTotalPence,
    galaxyTotal: galaxyFareFromReference(fare.referenceTotalPence),
    validUntil: fareValidUntil(fare).toISOString(),
    flags,
  };
}
