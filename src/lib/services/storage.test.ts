import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Booking } from "@/lib/domain/types";
import {
  BookingReferenceTakenError,
  BookingStorageError,
  bookingToRow,
  memoryBookingRepository,
  supabaseBookingRepository,
  unavailableBookingRepository,
} from "./bookings";
import { chooseStorage } from "./index";
import {
  memoryQuoteRequestRepository,
  quoteRequestToRow,
  supabaseQuoteRequestRepository,
  unavailableQuoteRequestRepository,
  type NewQuoteRequest,
} from "./quote-requests";
import { supabaseConfigFromEnv } from "./supabase/server-client";

type Row = Record<string, unknown>;
type DbError = { code: string; message: string; details?: string };

/**
 * A stand-in for the Supabase client: just enough of from().insert/select/eq/
 * order/limit/maybeSingle/single to exercise the repositories. No network.
 */
function fakeSupabase({ failWith }: { failWith?: DbError } = {}) {
  const tables: Record<string, Row[]> = { bookings: [], quote_requests: [] };
  let nextId = 1;

  const from = (table: string) => {
    let insertRow: Row | undefined;
    let columns = "*";
    const filters: [string, unknown][] = [];
    let order: [string, boolean] | undefined;
    let limit: number | undefined;

    const exec = async (mode: "many" | "maybeSingle" | "single") => {
      if (failWith) return { data: null, error: failWith };
      const rows = tables[table];
      const pick = (r: Row) => (columns === "*" ? structuredClone(r) : Object.fromEntries(columns.split(",").map((c) => [c, structuredClone(r[c])])));
      if (insertRow) {
        if (table === "bookings" && rows.some((r) => r.reference === insertRow!.reference)) {
          return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }
        const saved: Row = { ...structuredClone(insertRow) };
        if (table === "quote_requests") Object.assign(saved, { id: `qr-${nextId}`, status: "new", created_at: `2026-06-0${nextId++}T10:00:00Z` });
        rows.push(saved);
        return { data: mode === "many" ? null : pick(saved), error: null };
      }
      let found = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
      if (order) found = [...found].sort((a, b) => String(a[order![0]]).localeCompare(String(b[order![0]])) * (order![1] ? 1 : -1));
      if (limit !== undefined) found = found.slice(0, limit);
      if (mode === "many") return { data: found.map(pick), error: null };
      return { data: found[0] ? pick(found[0]) : null, error: null };
    };

    const api = {
      insert(row: Row) {
        insertRow = row;
        return api;
      },
      select(cols = "*") {
        columns = cols;
        return api;
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return api;
      },
      order(column: string, { ascending }: { ascending: boolean }) {
        order = [column, ascending];
        return api;
      },
      limit(n: number) {
        limit = n;
        return api;
      },
      maybeSingle: () => exec("maybeSingle"),
      single: () => exec("single"),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => exec("many").then(resolve, reject),
    };
    return api;
  };

  return { client: { from } as unknown as SupabaseClient, tables };
}

// Test fixture only — a made-up customer and journey.
const booking: Booking = {
  reference: "GAT-ABC234",
  status: "received",
  journey: {
    tripType: "return",
    pickup: {
      kind: "address",
      address: { id: "pc:SW1A 1AA", kind: "postcode", label: "SW1A 1AA", postcode: "SW1A 1AA", lat: 51.5, lng: -0.14, line1: "1 Test Street" },
    },
    dropoff: { kind: "airport", airport: "LHR", terminal: "T5" },
    extraStops: [],
    date: "2026-06-10",
    time: "09:00",
    pickupAtUtc: "2026-06-10T08:00:00.000Z",
    passengers: 2,
    luggage: { large: 0, small: 0 },
    luggageCategory: "suitcases",
    distanceMiles: 20,
    extras: { meetAndGreet: false, childSeats: 0 },
    returnJourney: {
      pickup: { kind: "airport", airport: "LHR", terminal: "T5" },
      extraStops: [],
      date: "2026-06-17",
      time: "18:00",
      pickupAtUtc: "2026-06-17T17:00:00.000Z",
      flightNumber: "BA123",
    },
  },
  vehicleId: "saloon",
  addOns: { meetAndGreet: false, childSeats: 0 },
  lines: [{ code: "fixed_fare", label: "Fixed return fare", amount: 19800 }],
  total: 19800,
  pricingVersion: "reference-fares-2",
  referenceFare: { id: "TEST-FARE", referenceTotal: 20000, checkedAt: "2026-06-01T10:00:00+01:00" },
  customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
  payment: { status: "unpaid", method: "To be arranged" },
  flightCheck: { status: "unverified" },
  createdAt: "2026-06-03T11:00:00.000Z",
};

describe("supabaseBookingRepository", () => {
  it("saves a booking and reads it back unchanged", async () => {
    const { client } = fakeSupabase();
    const repo = supabaseBookingRepository(client);
    await repo.create(booking);
    expect(await repo.findByReference("GAT-ABC234")).toEqual(booking);
  });

  it("looks references up in capitals, for both lookups", async () => {
    const { client } = fakeSupabase();
    const repo = supabaseBookingRepository(client);
    await repo.create(booking);
    expect((await repo.findByReference(" gat-abc234 "))?.reference).toBe("GAT-ABC234");
    expect(await repo.exists("gat-abc234")).toBe(true);
    expect(await repo.exists("GAT-ZZZ222")).toBe(false);
    expect(await repo.findByReference("GAT-ZZZ222")).toBeNull();
  });

  it("stores key columns that agree with the booking", async () => {
    const { client, tables } = fakeSupabase();
    await supabaseBookingRepository(client).create(booking);
    expect(tables.bookings[0]).toMatchObject({
      reference: "GAT-ABC234",
      status: "received",
      trip_type: "return",
      vehicle_id: "saloon",
      pickup_at: "2026-06-10T08:00:00.000Z",
      return_pickup_at: "2026-06-17T17:00:00.000Z",
      total_pence: 19800,
      reference_fare_id: "TEST-FARE",
      reference_total_pence: 20000,
      payment_status: "unpaid",
      customer_email: "sam@example.com",
      review_flags: [],
    });
    const oneWay = bookingToRow({ ...booking, journey: { ...booking.journey, tripType: "one_way", returnJourney: undefined } });
    expect(oneWay.return_pickup_at).toBeNull();
  });

  it("reports a taken reference distinctly", async () => {
    const { client } = fakeSupabase();
    const repo = supabaseBookingRepository(client);
    await repo.create(booking);
    const second = repo.create({ ...booking, customer: { ...booking.customer, name: "Someone Else" } });
    await expect(second).rejects.toBeInstanceOf(BookingReferenceTakenError);
    await expect(second).rejects.toBeInstanceOf(BookingStorageError);
  });

  it("turns database errors into storage errors that carry no customer details", async () => {
    const failWith = { code: "23514", message: "new row violates check constraint", details: "Failing row contains (GAT-ABC234, Sam Taylor, sam@example.com, 07700 900123)" };
    const repo = supabaseBookingRepository(fakeSupabase({ failWith }).client);
    for (const attempt of [repo.create(booking), repo.findByReference("GAT-ABC234"), repo.exists("GAT-ABC234")]) {
      const err = await attempt.then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(BookingStorageError);
      expect(err).not.toBeInstanceOf(BookingReferenceTakenError);
      expect((err as BookingStorageError).code).toBe("23514");
      expect(JSON.stringify({ ...(err as object), message: (err as Error).message })).not.toMatch(/Sam|example\.com|07700/);
    }
  });
});

describe("memory and unavailable booking repositories", () => {
  afterEach(() => {
    delete (globalThis as { __gatBookings?: unknown }).__gatBookings;
  });

  it("memory: refuses a taken reference and ignores case", async () => {
    const repo = memoryBookingRepository();
    await repo.create(booking);
    await expect(repo.create(booking)).rejects.toBeInstanceOf(BookingReferenceTakenError);
    expect(await repo.exists("gat-abc234")).toBe(true);
  });

  it("unavailable: every operation fails, so nothing is reported as saved", async () => {
    const repo = unavailableBookingRepository();
    await expect(repo.create(booking)).rejects.toBeInstanceOf(BookingStorageError);
    await expect(repo.findByReference("GAT-ABC234")).rejects.toBeInstanceOf(BookingStorageError);
    await expect(repo.exists("GAT-ABC234")).rejects.toBeInstanceOf(BookingStorageError);
  });
});

const request: NewQuoteRequest = {
  customer: { name: "Sam Taylor", phone: "07700 900123" },
  journeyKind: "from_airport",
  airport: "LGW",
  tripType: "one_way",
  pickupAtUtc: "2026-06-10T08:00:00.000Z",
  dropoffPostcode: "SW1A 1AA",
  reason: "NO_MATCHING_FARE",
  journey: {
    pickup: { kind: "airport", airport: "LGW", terminal: "N" },
    dropoff: { kind: "address", locationId: "pc:SW1A 1AA" },
    extraStops: [],
    date: "2026-06-10",
    time: "09:00",
    passengers: 2,
  },
};

describe("quote request repositories", () => {
  afterEach(() => {
    delete (globalThis as { __gatQuoteRequests?: unknown }).__gatQuoteRequests;
  });

  it("never stores a price", () => {
    expect(Object.keys(quoteRequestToRow(request)).filter((k) => /price|total|pence|amount|fare/i.test(k))).toEqual([]);
  });

  it.each([
    ["Supabase", () => supabaseQuoteRequestRepository(fakeSupabase().client)],
    ["memory", () => memoryQuoteRequestRepository()],
  ])("%s: saves requests as new and lists them newest first, by status", async (_label, make) => {
    const repo = make();
    const first = await repo.create(request);
    await new Promise((r) => setTimeout(r, 2)); // distinct creation times for the memory store
    const second = await repo.create({ ...request, customer: { ...request.customer, email: "sam@example.com" }, message: "Two cases" });
    expect(first).toMatchObject({ status: "new", reason: "NO_MATCHING_FARE", customer: { name: "Sam Taylor" }, journeyKind: "from_airport" });
    expect(first.id).toBeTruthy();
    expect((await repo.list()).map((r) => r.id)).toEqual([second.id, first.id]);
    expect((await repo.list({ status: "closed" })).length).toBe(0);
    expect((await repo.list({ limit: 1 })).length).toBe(1);
  });

  it("stores an address-to-address request with no airport, and reads it back the same", async () => {
    const a2a: NewQuoteRequest = {
      ...request,
      journeyKind: "address_to_address",
      airport: undefined,
      pickupPostcode: "EC1A 1BB",
      journey: { ...request.journey, pickup: { kind: "address", locationId: "pc:EC1A 1BB" } },
    };
    expect(quoteRequestToRow(a2a)).toMatchObject({
      journey_kind: "address_to_address",
      airport: null,
      pickup_postcode: "EC1A 1BB",
      dropoff_postcode: "SW1A 1AA",
    });
    const saved = await supabaseQuoteRequestRepository(fakeSupabase().client).create(a2a);
    expect(saved).not.toHaveProperty("airport");
    expect(saved).toMatchObject({ journeyKind: "address_to_address", pickupPostcode: "EC1A 1BB", dropoffPostcode: "SW1A 1AA" });
  });

  it("unavailable: refuses to save", async () => {
    await expect(unavailableQuoteRequestRepository().create(request)).rejects.toBeInstanceOf(BookingStorageError);
  });
});

describe("choosing storage", () => {
  const secret = "sb_secret_test-value-that-must-never-be-logged";

  it("reads both settings, or neither", () => {
    expect(supabaseConfigFromEnv({ SUPABASE_URL: " https://example.supabase.co ", SUPABASE_SECRET_KEY: ` ${secret} ` })).toEqual({
      url: "https://example.supabase.co",
      secretKey: secret,
    });
    expect(supabaseConfigFromEnv({ SUPABASE_URL: "https://example.supabase.co" })).toBeNull();
    expect(supabaseConfigFromEnv({ SUPABASE_SECRET_KEY: secret })).toBeNull();
  });

  it("uses Supabase when configured, without logging the key", () => {
    const logs = [vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {})];
    const storage = chooseStorage({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: secret, NODE_ENV: "production" });
    expect(storage.kind).toBe("supabase");
    expect(logs.flatMap((l) => l.mock.calls.flat()).join(" ")).not.toContain(secret);
  });

  it("uses memory in development and refuses bookings in production when not configured", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(chooseStorage({ NODE_ENV: "development" }).kind).toBe("memory");
    const production = chooseStorage({ NODE_ENV: "production", SUPABASE_URL: "https://example.supabase.co" });
    expect(production.kind).toBe("unavailable");
    await expect(production.bookings.create(booking)).rejects.toBeInstanceOf(BookingStorageError);
    expect(error.mock.calls.flat().join(" ")).toContain("online bookings are refused");
  });
});
