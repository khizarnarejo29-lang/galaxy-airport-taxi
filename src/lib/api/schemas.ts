/**
 * Structural parsing of untrusted request bodies. Business rules (dates,
 * capacity, terminals…) live in lib/domain/validation and run afterwards.
 */
import { z } from "zod";
import { fleet } from "@/config/fleet";
import { airportCodes } from "@/lib/domain/airports";
import { fieldError, type ApiErrorBody } from "@/lib/domain/errors";
import type { VehicleId } from "@/lib/domain/types";

const count = z.number().int().min(0).max(20);
const text = (max: number) => z.string().max(max * 2);

const address = z.object({
  locationId: z.string().min(1).max(200),
  line1: text(120).optional(),
  postcode: text(10).optional(),
});

export const journeySchema = z.object({
  direction: z.enum(["to_airport", "from_airport"]),
  airport: z.enum(airportCodes),
  terminal: z.string().max(10).optional(),
  address,
  extraStops: z.array(address).max(5).default([]),
  date: z.string().max(10),
  time: z.string().max(5),
  passengers: z.number().int().min(0).max(100).nullable(),
  luggage: z.object({ large: count, small: count }),
  flightNumber: z.string().max(12).optional(),
});

export const bookingSchema = z.object({
  quoteToken: z.string().min(1).max(20_000),
  vehicleId: z.enum(fleet.map((v) => v.id) as [VehicleId, ...VehicleId[]]),
  addOns: z.object({ meetAndGreet: z.boolean(), childSeats: count }),
  customer: z.object({ name: text(100), email: text(200), phone: text(30) }),
  addressLine1: text(120),
  addressPostcode: text(10).optional(),
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
