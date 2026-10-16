/**
 * Decides what the booking confirmation page may show. Personal details only
 * with a valid viewing pass; otherwise just the reference.
 */
import type { Booking } from "@/lib/domain/types";
import type { BookingRepository } from "@/lib/services/bookings";
import { isValidViewPass } from "./view-pass";

export type BookingView =
  /** The browser that made the booking, within 60 minutes: full confirmation. */
  | { kind: "full"; booking: Booking }
  /** Anyone else: the booking exists, but no personal details are shown. */
  | { kind: "restricted"; reference: string }
  /** Storage couldn't be reached: show the reference only. */
  | { kind: "unavailable"; reference: string }
  | { kind: "not_found" };

const REFERENCE = /^GAT-[A-Z0-9]{6}$/;

export async function bookingView(
  rawReference: string,
  pass: string | undefined,
  bookings: BookingRepository,
  now: Date = new Date(),
): Promise<BookingView> {
  const reference = rawReference.trim().toUpperCase();
  if (!REFERENCE.test(reference)) return { kind: "not_found" };

  try {
    if (isValidViewPass(pass, reference, now)) {
      const booking = await bookings.findByReference(reference);
      return booking ? { kind: "full", booking } : { kind: "not_found" };
    }
    return (await bookings.exists(reference)) ? { kind: "restricted", reference } : { kind: "not_found" };
  } catch (err) {
    console.error(`[booking page] lookup failed (${err instanceof Error ? err.name : "unknown"})`);
    return { kind: "unavailable", reference };
  }
}
