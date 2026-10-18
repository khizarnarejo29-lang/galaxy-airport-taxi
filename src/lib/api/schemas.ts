/**
 * Structural parsing of untrusted request bodies. Business rules (dates,
 * capacity, terminals…) live in lib/domain/validation and run afterwards.
 */
import { z } from "zod";
import { fleet } from "@/config/fleet";
import { airportCodes } from "@/lib/domain/airports";
import { fieldError, type ApiErrorBody } from "@/lib/domain/errors";
import { luggageCategories, type VehicleId } from "@/lib/domain/types";

const count = z.number().int().min(0).max(20);
const text = (max: number) => z.string().max(max * 2);

const address = z
  .object({
    locationId: z.string().min(1).max(200),
    line1: text(120).optional(),
  })
  .strict();

/** A journey end: an address from postcode search, or an airport. Which combinations are allowed is a business rule. */
const end = z.discriminatedUnion("kind", [
  address.extend({ kind: z.literal("address") }).strict(),
  z.object({ kind: z.literal("airport"), airport: z.enum(airportCodes), terminal: z.string().max(10).optional() }).strict(),
]);

const addOns = z.object({ meetAndGreet: z.boolean(), childSeats: count });

export const journeySchema = z.object({
  pickup: end,
  dropoff: end,
  extraStops: z.array(address).max(5).default([]),
  date: z.string().max(10),
  time: z.string().max(5),
  passengers: z.number().int().min(0).max(100).nullable(),
  flightNumber: z.string().max(12).optional(),
  tripType: z.enum(["one_way", "return"]).optional(),
  returnJourney: z
    .object({
      /** The way back always ends at the outward pickup, so only its pickup is sent. */
      pickup: end,
      extraStops: z.array(address).max(5).default([]),
      date: z.string().max(10),
      time: z.string().max(5),
      flightNumber: z.string().max(12).optional(),
    })
    .strict()
    .optional(),
  /** Required: none, hand luggage or suitcases. Anything else, or nothing, is rejected. */
  luggageCategory: z.enum(luggageCategories),
  /** Optional, with suitcases: hand luggage as well. Never changes the price. */
  handLuggageToo: z.boolean().optional(),
  /** Required: large or unusual items (bikes, golf bags…) are never priced instantly. */
  largeItems: z.boolean(),
  extras: addOns.optional(),
})
  // Unknown fields are refused, so old luggage-count or airport-and-direction requests can't slip through.
  .strict();

export const bookingSchema = z.object({
  quoteToken: z.string().min(1).max(20_000),
  vehicleId: z.enum(fleet.map((v) => v.id) as [VehicleId, ...VehicleId[]]),
  addOns,
  customer: z.object({ name: text(100), email: text(200), phone: text(30) }),
  /** House number and street for each address end; required by validation where that end is an address. */
  pickupLine1: text(120).optional(),
  dropoffLine1: text(120).optional(),
  /** Only for a return collected from a different address than the outward drop-off. */
  returnPickupLine1: text(120).optional(),
  specialRequirements: text(500).optional(),
  notes: text(1000).optional(),
  expectedTotal: z.number().int().nonnegative(),
});

export function badRequest(): Response {
  const body: ApiErrorBody = { ok: false, errors: [fieldError("request", "BAD_REQUEST")] };
  return Response.json(body, { status: 400 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
