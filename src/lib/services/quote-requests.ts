import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AirportCode, JourneyInput, JourneyKind, TripType } from "@/lib/domain/types";
import { BookingStorageError } from "./bookings";

/**
 * A request for a price on a journey that couldn't be priced online.
 * Storage only: no website form or endpoint uses this yet. It deliberately
 * has no price fields — a quote request never carries an amount.
 */
export type QuoteRequestStatus = "new" | "contacted" | "priced" | "booked" | "closed";

export interface NewQuoteRequest {
  customer: { name: string; phone: string; email?: string };
  journeyKind: JourneyKind;
  /** The airport the journey uses; none for address-to-address journeys. */
  airport?: AirportCode;
  tripType: TripType;
  /** Outward pickup, ISO 8601 UTC. */
  pickupAtUtc: string;
  pickupPostcode?: string;
  dropoffPostcode?: string;
  /** Why no instant price was available, e.g. "NO_MATCHING_FARE". */
  reason: string;
  /** The journey as the customer entered it. */
  journey: JourneyInput;
  message?: string;
}

export interface QuoteRequest extends NewQuoteRequest {
  id: string;
  status: QuoteRequestStatus;
  createdAt: string;
}

export interface QuoteRequestRepository {
  create(request: NewQuoteRequest): Promise<QuoteRequest>;
  /** Newest first. */
  list(options?: { status?: QuoteRequestStatus; limit?: number }): Promise<QuoteRequest[]>;
}

const DEFAULT_LIMIT = 50;

/** In-memory store for development only. */
export function memoryQuoteRequestRepository(): QuoteRequestRepository {
  const store = ((globalThis as { __gatQuoteRequests?: QuoteRequest[] }).__gatQuoteRequests ??= []);
  return {
    async create(request) {
      const saved: QuoteRequest = { ...structuredClone(request), id: randomUUID(), status: "new", createdAt: new Date().toISOString() };
      store.push(saved);
      return structuredClone(saved);
    },
    async list({ status, limit = DEFAULT_LIMIT } = {}) {
      return store
        .filter((r) => !status || r.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },
  };
}

/** Used in production when no database is configured. */
export function unavailableQuoteRequestRepository(): QuoteRequestRepository {
  const fail = async (): Promise<never> => {
    throw new BookingStorageError("Quote request storage is not configured");
  };
  return { create: fail, list: fail };
}

interface QuoteRequestRow {
  id: string;
  status: QuoteRequestStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  journey_kind: JourneyKind;
  airport: AirportCode | null;
  trip_type: TripType;
  pickup_at: string;
  pickup_postcode: string | null;
  dropoff_postcode: string | null;
  reason: string;
  journey: JourneyInput;
  message: string | null;
  created_at: string;
}

export function quoteRequestToRow(r: NewQuoteRequest) {
  return {
    customer_name: r.customer.name,
    customer_phone: r.customer.phone,
    customer_email: r.customer.email ?? null,
    journey_kind: r.journeyKind,
    airport: r.airport ?? null,
    trip_type: r.tripType,
    pickup_at: r.pickupAtUtc,
    pickup_postcode: r.pickupPostcode ?? null,
    dropoff_postcode: r.dropoffPostcode ?? null,
    reason: r.reason,
    journey: r.journey,
    message: r.message ?? null,
  };
}

function rowToQuoteRequest(row: QuoteRequestRow): QuoteRequest {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    customer: { name: row.customer_name, phone: row.customer_phone, ...(row.customer_email ? { email: row.customer_email } : {}) },
    journeyKind: row.journey_kind,
    ...(row.airport ? { airport: row.airport } : {}),
    tripType: row.trip_type,
    pickupAtUtc: row.pickup_at,
    ...(row.pickup_postcode ? { pickupPostcode: row.pickup_postcode } : {}),
    ...(row.dropoff_postcode ? { dropoffPostcode: row.dropoff_postcode } : {}),
    reason: row.reason,
    journey: row.journey,
    ...(row.message ? { message: row.message } : {}),
  };
}

/** Quote requests in the Supabase `quote_requests` table. Server-side only. */
export function supabaseQuoteRequestRepository(client: SupabaseClient): QuoteRequestRepository {
  const table = () => client.from("quote_requests");
  return {
    async create(request) {
      const { data, error } = await table().insert(quoteRequestToRow(request)).select("*").single();
      if (error || !data) throw new BookingStorageError("Quote request save failed", error?.code);
      return rowToQuoteRequest(data as QuoteRequestRow);
    },
    async list({ status, limit = DEFAULT_LIMIT } = {}) {
      let query = table().select("*").order("created_at", { ascending: false }).limit(limit);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new BookingStorageError("Quote request lookup failed", error.code);
      return ((data ?? []) as QuoteRequestRow[]).map(rowToQuoteRequest);
    },
  };
}
