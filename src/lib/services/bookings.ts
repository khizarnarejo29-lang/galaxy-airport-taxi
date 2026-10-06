import type { Booking } from "@/lib/domain/types";

export interface BookingRepository {
  create(booking: Booking): Promise<void>;
  findByReference(reference: string): Promise<Booking | null>;
  exists(reference: string): Promise<boolean>;
}

/**
 * In-memory store for development only. Bookings are lost on restart and are
 * not shared between server instances — replace with a database before launch.
 */
export function memoryBookingRepository(): BookingRepository {
  const store = ((globalThis as { __gatBookings?: Map<string, Booking> }).__gatBookings ??= new Map());
  return {
    async create(booking) {
      store.set(booking.reference, structuredClone(booking));
    },
    async findByReference(reference) {
      const found = store.get(reference.toUpperCase());
      return found ? structuredClone(found) : null;
    },
    async exists(reference) {
      return store.has(reference);
    },
  };
}
