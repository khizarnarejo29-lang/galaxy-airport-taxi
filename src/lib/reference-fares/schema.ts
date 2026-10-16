/**
 * The shape of a stored reference fare, and the checks every entry must pass
 * before it can be used. An entry records exactly what was checked on the
 * reference website — nothing is derived or estimated.
 */
import { z } from "zod";
import { excludedReferenceVehicles, referenceFareRules, referenceVehicles } from "@/config/reference-vehicles";
import { airportCodes } from "@/lib/domain/airports";
import { luggageCategories } from "@/lib/domain/types";
import { normalisePostcode } from "@/lib/domain/geo";

const postcode = z
  .string()
  .refine((v) => normalisePostcode(v) === v, "Postcode must be a full UK postcode in the form \"E1 5NF\"");

const timestamp = z.string().refine((v) => /[+-]\d{2}:\d{2}$|Z$/.test(v) && !Number.isNaN(Date.parse(v)), {
  message: "Timestamp must be ISO 8601 with a time zone, e.g. 2026-10-12T20:10:00+01:00",
});

const addressEnd = z
  .object({
    kind: z.literal("address"),
    /** House number/name and street exactly as chosen on the reference site. */
    line1: z.string().min(1),
    postcode,
  })
  .strict();

const airportEnd = z
  .object({
    kind: z.literal("airport"),
    airport: z.enum(airportCodes),
    /** Terminal id as in lib/domain/airports, or null for single-terminal airports. */
    terminal: z.string().min(1).nullable(),
  })
  .strict();

/** A journey end: an address, or an airport. */
const end = z.discriminatedUnion("kind", [addressEnd, airportEnd]);

const count = z.number().int().min(0).max(20);

const londonDate = z
  .string()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), {
    message: "Date must be YYYY-MM-DD",
  });

/** A travel date (or outbound/return pair) the reference price was seen to apply to. */
const travelDates = z.object({ outbound: londonDate, return: londonDate.optional() }).strict();

/**
 * One passenger count and luggage category the owner confirmed for this fare,
 * for both the reference vehicle and the Galaxy vehicle. Only exact matches price.
 */
const party = z
  .object({
    passengers: z.number().int().min(1).max(20),
    luggage: z.enum(luggageCategories),
  })
  .strict();

/**
 * The return leg is priced only once its route has been seen and confirmed.
 * It always ends at the outward pickup, so only its pickup and stops are recorded.
 */
const returnLeg = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unconfirmed") }).strict(),
  z.object({ status: z.literal("confirmed"), pickup: end, stops: z.array(postcode) }).strict(),
]);

export const referenceFareSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(["pending", "approved"]),
    pickup: end,
    dropoff: end,
    tripType: z.enum(["one_way", "return"]),
    /** Required for returns; must be absent for one-way fares. */
    returnLeg: returnLeg.optional(),
    referenceVehicle: z.enum(referenceVehicles),
    /** Combinations confirmed for both the reference class and the Galaxy vehicle. Empty = never matches. */
    confirmedParties: z.array(party),
    /** Postcodes of stops on the outbound leg, in order. */
    stops: z.array(postcode),
    extras: z.object({ meetAndGreet: z.boolean(), childSeats: count }),
    /**
     * Travel dates whose reference price was verified to equal this total.
     * Other dates are never priced (surcharges can apply outside the
     * published windows). Return fares list outbound + return pairs.
     */
    verifiedTravelDates: z.array(travelDates),
    currency: z.literal("GBP"),
    vatIncluded: z.literal(true),
    /** The full total the reference site showed for this booking, in pence. */
    referenceTotalPence: z.number().int(),
    checkedAt: timestamp,
    checkedBy: z.string().min(1),
    approvedBy: z.string(),
    approvedAt: timestamp.nullable(),
    notes: z.string().optional(),
  })
  .strict();

export type ReferenceFare = z.infer<typeof referenceFareSchema>;
export type FareEnd = z.infer<typeof end>;
export type ReferenceParty = z.infer<typeof party>;

/**
 * House number and street compared case- and punctuation-insensitively.
 * Used for both matching and duplicate detection so the two always agree.
 */
export function normaliseAddressLine(line: string): string {
  return line
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const endKey = (e: FareEnd) =>
  e.kind === "address" ? ["address", e.postcode, normaliseAddressLine(e.line1)] : ["airport", e.airport, e.terminal];

/** Same postcode, or the same airport. */
const samePlace = (a: FareEnd, b: FareEnd) =>
  a.kind === "address" ? b.kind === "address" && a.postcode === b.postcode : b.kind === "airport" && a.airport === b.airport;

/** Two entries with the same key would describe the same booking. */
export function fareKey(f: ReferenceFare): string {
  const leg = f.returnLeg?.status === "confirmed" ? f.returnLeg : null;
  return JSON.stringify([
    endKey(f.pickup),
    endKey(f.dropoff),
    f.tripType,
    leg && [endKey(leg.pickup), leg.stops],
    f.referenceVehicle,
    f.stops,
    f.extras.meetAndGreet,
    f.extras.childSeats,
  ]);
}

export interface FareDataProblem {
  index: number;
  id?: string;
  message: string;
}

/** Every reason a list of stored fares can't be used. Empty means valid. */
export function checkFareData(data: unknown, now: Date = new Date()): FareDataProblem[] {
  if (!Array.isArray(data)) return [{ index: -1, message: "Fare data must be a list" }];
  const problems: FareDataProblem[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Map<string, string>();

  data.forEach((raw, index) => {
    const parsed = referenceFareSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({ index, message: `${issue.path.join(".") || "entry"}: ${issue.message}` });
      }
      return;
    }
    const f = parsed.data;
    const add = (message: string) => problems.push({ index, id: f.id, message });

    if (seenIds.has(f.id)) add("Duplicate id");
    seenIds.add(f.id);

    if (f.referenceTotalPence <= referenceFareRules.discountPence) {
      add(`Reference total must be more than £${referenceFareRules.discountPence / 100}`);
    }
    if (excludedReferenceVehicles.includes(f.referenceVehicle)) add(`${f.referenceVehicle} is excluded from pricing`);
    if (Date.parse(f.checkedAt) > now.getTime()) add("checkedAt is in the future");

    if (f.tripType === "return" && !f.returnLeg) add("A return fare needs a returnLeg (use status \"unconfirmed\" if unknown)");
    if (f.tripType === "one_way" && f.returnLeg) add("A one-way fare must not have a returnLeg");

    // The same route rules as the website: no airport-to-airport legs, no leg that starts where it ends.
    if (f.pickup.kind === "airport" && f.dropoff.kind === "airport") add("Airport-to-airport journeys can't be priced");
    else if (samePlace(f.pickup, f.dropoff)) add("Pickup and drop-off are the same place");
    const leg = f.returnLeg?.status === "confirmed" ? f.returnLeg : null;
    if (leg) {
      // The way back may start at another address, or at the airport the outward journey went to.
      if (leg.pickup.kind === "airport" && !(f.dropoff.kind === "airport" && f.dropoff.airport === leg.pickup.airport)) {
        add("A return can only be collected from an airport the outward journey went to");
      } else if (samePlace(leg.pickup, f.pickup)) add("The return pickup is the same place as the outward pickup");
    }
    // Not decidable until an unconfirmed return route is known (such a fare never matches anyway).
    const returnUnknown = f.returnLeg?.status === "unconfirmed";
    if (f.extras.meetAndGreet && !returnUnknown && f.pickup.kind !== "airport" && leg?.pickup.kind !== "airport") {
      add("Meet & Greet needs an airport pickup on one of the legs");
    }

    const seenParties = new Set<string>();
    for (const party of f.confirmedParties) {
      const k = `${party.passengers}p ${party.luggage}`;
      if (seenParties.has(k)) add(`Confirmed combination ${k} is listed twice`);
      seenParties.add(k);
    }

    const seenDates = new Set<string>();
    for (const d of f.verifiedTravelDates) {
      if (f.tripType === "return" && !d.return) add(`Verified date ${d.outbound} needs a return date`);
      if (f.tripType === "one_way" && d.return) add(`Verified date ${d.outbound} must not have a return date on a one-way fare`);
      if (d.return && d.return < d.outbound) add(`Verified return date ${d.return} is before ${d.outbound}`);
      const k = `${d.outbound}/${d.return ?? ""}`;
      if (seenDates.has(k)) add(`Verified date ${k} is listed twice`);
      seenDates.add(k);
    }

    if (f.status === "approved") {
      if (!f.approvedBy.trim()) add("Approved fares need approvedBy");
      if (!f.approvedAt) add("Approved fares need approvedAt");
      else if (Date.parse(f.approvedAt) < Date.parse(f.checkedAt)) add("approvedAt is before checkedAt");
    }

    // One pending re-check may sit beside the approved fare it will replace.
    const key = `${f.status}:${fareKey(f)}`;
    const clash = seenKeys.get(key);
    if (clash) add(`Describes the same booking as "${clash}" with the same status (${f.status})`);
    else seenKeys.set(key, f.id);
  });

  return problems;
}
