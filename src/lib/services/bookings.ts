import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking } from "@/lib/domain/types";

export interface BookingRepository {
  /** Saves a new booking. Throws BookingReferenceTakenError if the reference already exists. */
  create(booking: Booking): Promise<void>;
  findByReference(reference: string): Promise<Booking | null>;
  exists(reference: string): Promise<boolean>;
  /** Replaces a saved booking (e.g. once it is paid). Throws if it was never saved. */
  update(booking: Booking): Promise<void>;
  /** Newest first, for the admin page. */
  list?(limit: number): Promise<Booking[]>;
}

/**
 * Storage failed or isn't available. Messages carry only the operation and a
 * database error code — never booking or customer details.
 */
export class BookingStorageError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "BookingStorageError";
  }
}

/** Another booking already has this reference; pick a new one and try again. */
export class BookingReferenceTakenError extends BookingStorageError {
  constructor() {
    super("Booking reference already in use", "23505");
    this.name = "BookingReferenceTakenError";
  }
}

/** References are always stored and looked up in capitals. */
const normaliseReference = (reference: string) => reference.trim().toUpperCase();

/**
 * In-memory store for development only. Bookings are lost on restart and are
 * not shared between server instances.
 */
export function memoryBookingRepository(): BookingRepository {
  const store = ((globalThis as { __gatBookings?: Map<string, Booking> }).__gatBookings ??= new Map());
  return {
    async create(booking) {
      const key = normaliseReference(booking.reference);
      if (store.has(key)) throw new BookingReferenceTakenError();
      store.set(key, structuredClone(booking));
    },
    async findByReference(reference) {
      const found = store.get(normaliseReference(reference));
      return found ? structuredClone(found) : null;
    },
    async exists(reference) {
      return store.has(normaliseReference(reference));
    },
    async update(booking) {
      const key = normaliseReference(booking.reference);
      if (!store.has(key)) throw new BookingStorageError("Booking update failed");
      store.set(key, structuredClone(booking));
    },
    async list(limit) {
      return [...store.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((b) => structuredClone(b));
    },
  };
}

/** Used in production when no database is configured: every booking is refused, never silently lost. */
export function unavailableBookingRepository(): BookingRepository {
  const fail = async (): Promise<never> => {
    throw new BookingStorageError("Booking storage is not configured");
  };
  return { create: fail, findByReference: fail, exists: fail, update: fail };
}

/** Key columns for searching and constraints; the full booking is kept as JSON. */
export function bookingToRow(b: Booking) {
  return {
    reference: normaliseReference(b.reference),
    status: b.status,
    trip_type: b.journey.tripType,
    vehicle_id: b.vehicleId,
    pickup_at: b.journey.pickupAtUtc,
    return_pickup_at: b.journey.returnJourney?.pickupAtUtc ?? null,
    total_pence: b.total,
    pricing_version: b.pricingVersion,
    reference_fare_id: b.referenceFare?.id ?? null,
    reference_total_pence: b.referenceFare?.referenceTotal ?? null,
    payment_status: b.payment.status,
    customer_name: b.customer.name,
    customer_email: b.customer.email,
    customer_phone: b.customer.phone,
    review_flags: b.reviewFlags ?? [],
    booking: { ...b, reference: normaliseReference(b.reference) },
  };
}

const UNIQUE_VIOLATION = "23505";

/** Bookings in the Supabase `bookings` table (see supabase/migrations). Server-side only. */
export function supabaseBookingRepository(client: SupabaseClient): BookingRepository {
  const table = () => client.from("bookings");
  const failed = (operation: string, error: { code?: string }) =>
    new BookingStorageError(`Booking ${operation} failed`, error.code);

  return {
    async create(booking) {
      const { error } = await table().insert(bookingToRow(booking));
      if (error?.code === UNIQUE_VIOLATION) throw new BookingReferenceTakenError();
      if (error) throw failed("save", error);
    },
    async findByReference(reference) {
      const { data, error } = await table().select("booking").eq("reference", normaliseReference(reference)).maybeSingle();
      if (error) throw failed("lookup", error);
      return data ? (data.booking as Booking) : null;
    },
    async exists(reference) {
      const { data, error } = await table().select("reference").eq("reference", normaliseReference(reference)).maybeSingle();
      if (error) throw failed("lookup", error);
      return data !== null;
    },
    async update(booking) {
      const { reference, ...row } = bookingToRow(booking);
      const { data, error } = await table().update(row).eq("reference", reference).select("reference");
      if (error) throw failed("update", error);
      if (!data?.length) throw new BookingStorageError("Booking update failed");
    },
    async list(limit) {
      const { data, error } = await table().select("booking").order("created_at", { ascending: false }).limit(limit);
      if (error) throw failed("lookup", error);
      return (data ?? []).map((r) => r.booking as Booking);
    },
  };
}
