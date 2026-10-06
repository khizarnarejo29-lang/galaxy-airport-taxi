import { describe, expect, it, vi } from "vitest";
import type { Booking, JourneyInput, ResolvedLocation } from "@/lib/domain/types";
import { createQuote } from "@/lib/quote/create-quote";
import { verifyQuote } from "@/lib/quote/token";
import type { Services } from "@/lib/services";
import { estimatedDistance } from "@/lib/services/distance";
import { LocationLookupError, type LocationProvider } from "@/lib/services/location/types";
import { createBooking, type BookingRequest } from "./create-booking";

const now = new Date("2026-10-05T09:00:00Z");

const places: Record<string, ResolvedLocation> = {
  "pc:SW1A 1AA": { id: "pc:SW1A 1AA", kind: "postcode", label: "SW1A 1AA", postcode: "SW1A 1AA", outcode: "SW1A", region: "London", lat: 51.501, lng: -0.1416 },
  "pc:RH6 0NP": { id: "pc:RH6 0NP", kind: "postcode", label: "RH6 0NP", postcode: "RH6 0NP", outcode: "RH6", region: "South East", lat: 51.1537, lng: -0.1821 },
  "pc:OX1 1AA": { id: "pc:OX1 1AA", kind: "postcode", label: "OX1 1AA", postcode: "OX1 1AA", outcode: "OX1", region: "South East", lat: 51.752, lng: -1.2577 },
  "pl:camden": { id: "pl:camden", kind: "place", label: "Camden Town", outcode: "NW1", region: "London", lat: 51.539, lng: -0.1426 },
  "pc:NW1 8NH": { id: "pc:NW1 8NH", kind: "postcode", label: "NW1 8NH", postcode: "NW1 8NH", outcode: "NW1", region: "London", lat: 51.5405, lng: -0.1437 },
};

const locations: LocationProvider = {
  search: async () => [],
  resolve: async (id) => places[id] ?? null,
  lookupPostcode: async (pc) => places[`pc:${pc}`] ?? null,
};

function services(overrides: Partial<Services> = {}): Services {
  const store = new Map<string, Booking>();
  return {
    locations,
    distance: estimatedDistance(),
    flights: { check: async () => ({ status: "unverified" }) },
    payments: { initialise: async () => ({ status: "unpaid", method: "To be arranged" }) },
    notifier: { bookingReceived: vi.fn(async () => {}), contactEnquiry: vi.fn(async () => {}) },
    bookings: {
      create: async (b) => void store.set(b.reference, b),
      findByReference: async (r) => store.get(r) ?? null,
      exists: async (r) => store.has(r),
    },
    ...overrides,
  };
}

const journey: JourneyInput = {
  direction: "to_airport",
  airport: "LHR",
  terminal: "T5",
  address: { locationId: "pc:SW1A 1AA" },
  extraStops: [],
  date: "2026-10-12",
  time: "06:30",
  passengers: 3,
  luggage: { large: 3, small: 1 },
};

describe("createQuote", () => {
  it("prices every vehicle and marks ones that can't fit", async () => {
    const result = await createQuote(journey, services(), { now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.quote.options.map((o) => [o.vehicleId, o]));
    expect(byId.saloon.available).toBe(false); // 3 large cases
    expect(byId.estate.available).toBe(true);
    expect(result.quote.journey.distanceMiles).toBeGreaterThan(10);
    expect(verifyQuote(result.token)?.journey.airport).toBe("LHR");
  });

  it("rejects addresses outside the service area", async () => {
    const r = await createQuote({ ...journey, address: { locationId: "pc:OX1 1AA" } }, services(), { now });
    expect(r.ok || r.errors.map((e) => e.code)).toEqual(["ADDRESS_OUTSIDE_AREA"]);
  });

  it("rejects airport-to-airport journeys", async () => {
    const r = await createQuote({ ...journey, address: { locationId: "pc:RH6 0NP" } }, services(), { now });
    expect(r.ok || r.errors.map((e) => e.code)).toEqual(["ROUTE_UNSUPPORTED"]);
  });

  it("reports lookup failures distinctly", async () => {
    const failing = services({
      locations: { ...locations, resolve: async () => Promise.reject(new LocationLookupError("down")) },
    });
    const r = await createQuote(journey, failing, { now });
    expect(r.ok || [r.status, r.errors[0].code]).toEqual([502, "LOCATION_LOOKUP_FAILED"]);
  });

  it("validates before doing any lookups", async () => {
    const resolve = vi.fn();
    const r = await createQuote({ ...journey, terminal: undefined }, services({ locations: { ...locations, resolve } }), { now });
    expect(r.ok || r.errors.map((e) => e.code)).toEqual(["TERMINAL_REQUIRED"]);
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("createBooking", () => {
  async function quoteFor(input: JourneyInput, svc: Services) {
    const r = await createQuote(input, svc, { now });
    if (!r.ok) throw new Error("quote failed");
    return r;
  }

  const request = (token: string, expectedTotal: number): BookingRequest => ({
    quoteToken: token,
    vehicleId: "estate",
    addOns: { meetAndGreet: false, childSeats: 1 },
    customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
    addressLine1: "1 Example Road",
    expectedTotal,
  });

  it("creates a booking with a server-calculated total and notifies", async () => {
    const svc = services();
    const { quote, token } = await quoteFor(journey, svc);
    const estate = quote.options.find((o) => o.vehicleId === "estate")!;
    const r = await createBooking(request(token, estate.total + 800), svc, { now });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.reference).toMatch(/^GAT-[2-9A-HJKMNP-Z]{6}$/);
    expect(r.booking.status).toBe("received");
    expect(r.booking.total).toBe(estate.total + 800);
    expect(await svc.bookings.exists(r.booking.reference)).toBe(true);
    expect(svc.notifier.bookingReceived).toHaveBeenCalledOnce();
  });

  it("refuses a tampered quote", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const r = await createBooking(request(token.replace(/.$/, "x"), 1), svc, { now });
    expect(r.ok || r.errors[0].code).toBe("QUOTE_INVALID");
  });

  it("refuses an expired quote", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const later = new Date(now.getTime() + 31 * 60_000);
    const r = await createBooking(request(token, 1), svc, { now: later });
    expect(r.ok || r.errors[0].code).toBe("QUOTE_EXPIRED");
  });

  it("refuses when the customer saw a different total", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const r = await createBooking(request(token, 1), svc, { now });
    expect(r.ok || r.errors[0].code).toBe("PRICE_CHANGED");
  });

  it("refuses a vehicle that can't carry the group", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const r = await createBooking({ ...request(token, 1), vehicleId: "saloon" }, svc, { now });
    expect(r.ok || r.errors[0].code).toBe("VEHICLE_UNAVAILABLE");
  });

  it("requires and checks a postcode when a named area was quoted", async () => {
    const svc = services();
    const { quote, token } = await quoteFor({ ...journey, address: { locationId: "pl:camden" } }, svc);
    const total = quote.options.find((o) => o.vehicleId === "estate")!.total + 800;

    const missing = await createBooking(request(token, total), svc, { now });
    expect(missing.ok || missing.errors[0].code).toBe("POSTCODE_REQUIRED");

    const ok = await createBooking({ ...request(token, total), addressPostcode: "nw1 8nh" }, svc, { now });
    expect(ok.ok && ok.booking.journey.address.postcode).toBe("NW1 8NH");
  });

  it("keeps the booking when the notification fails", async () => {
    const svc = services({ notifier: { bookingReceived: async () => Promise.reject(new Error("smtp")), contactEnquiry: async () => {} } });
    const { quote, token } = await quoteFor(journey, svc);
    const total = quote.options.find((o) => o.vehicleId === "estate")!.total + 800;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await createBooking(request(token, total), svc, { now });
    expect(r.ok).toBe(true);
  });
});
