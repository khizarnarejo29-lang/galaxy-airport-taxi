import { describe, expect, it, vi } from "vitest";
import type { Booking, JourneyInput, Quote, ResolvedLocation } from "@/lib/domain/types";
import { journeySchema } from "@/lib/api/schemas";
import type { PricedJourney } from "@/lib/domain/types";
import { priceVehicle } from "@/lib/reference-fares/journey-pricing";
import { activeTariff, type PricingConfig } from "@/config/pricing";
import { journeyFare } from "@/lib/pricing/engine";
import { createQuote } from "@/lib/quote/create-quote";
import { signQuote, verifyQuote } from "@/lib/quote/token";
import type { ReferenceFare } from "@/lib/reference-fares";
import type { Services } from "@/lib/services";
import { estimatedDistance } from "@/lib/services/distance";
import { BookingReferenceTakenError, BookingStorageError, unavailableBookingRepository } from "@/lib/services/bookings";
import { LocationLookupError, type LocationProvider } from "@/lib/services/location/types";
import { memoryQuoteRequestRepository } from "@/lib/services/quote-requests";
import { createBooking, type BookingRequest } from "./create-booking";

// Most tests here are about reference fares alone: without a tariff passed in, none is used.
// The "location tariff" tests pass their own; activeTariff itself is tested below.
vi.mock("@/config/pricing", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/config/pricing")>();
  return { ...real, activeTariff: (...args: Parameters<typeof real.activeTariff>) => (args.length ? real.activeTariff(...args) : null) };
});

// The area rules are tested on Greater London alone; the shipped area (the whole UK) is checked below.
vi.mock("@/config/service-area", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/config/service-area")>();
  return { ...real, serviceArea: { ...real.serviceArea, label: "Greater London", wholeUk: false } };
});

const now = new Date("2026-10-05T09:00:00Z");

const places: Record<string, ResolvedLocation> = {
  "pc:SW1A 1AA": { id: "pc:SW1A 1AA", kind: "postcode", label: "SW1A 1AA", postcode: "SW1A 1AA", outcode: "SW1A", region: "London", lat: 51.501, lng: -0.1416 },
  "pc:RH6 0NP": { id: "pc:RH6 0NP", kind: "postcode", label: "RH6 0NP", postcode: "RH6 0NP", outcode: "RH6", region: "South East", lat: 51.1537, lng: -0.1821 },
  "pc:OX1 1AA": { id: "pc:OX1 1AA", kind: "postcode", label: "OX1 1AA", postcode: "OX1 1AA", outcode: "OX1", region: "South East", lat: 51.752, lng: -1.2577 },
  "pl:camden": { id: "pl:camden", kind: "place", label: "Camden Town", outcode: "NW1", region: "London", lat: 51.539, lng: -0.1426 },
  "pc:NW1 8NH": { id: "pc:NW1 8NH", kind: "postcode", label: "NW1 8NH", postcode: "NW1 8NH", outcode: "NW1", region: "London", lat: 51.5405, lng: -0.1437 },
  "pc:EC1A 1BB": { id: "pc:EC1A 1BB", kind: "postcode", label: "EC1A 1BB", postcode: "EC1A 1BB", outcode: "EC1A", region: "London", lat: 51.5202, lng: -0.0976 },
  "pc:E1 6AN": { id: "pc:E1 6AN", kind: "postcode", label: "E1 6AN", postcode: "E1 6AN", outcode: "E1", region: "London", lat: 51.5205, lng: -0.0754 },
  "pc:W1A 1AA": { id: "pc:W1A 1AA", kind: "postcode", label: "W1A 1AA", postcode: "W1A 1AA", outcode: "W1A", region: "London", lat: 51.5186, lng: -0.1438 },
  // A Heathrow postcode: an ordinary London address, however close to the airport.
  "pc:TW6 2GA": { id: "pc:TW6 2GA", kind: "postcode", label: "TW6 2GA", postcode: "TW6 2GA", outcode: "TW6", region: "London", lat: 51.4713, lng: -0.4533 },
  // A different search result with the same postcode as SW1A 1AA.
  "alt:palace": { id: "alt:palace", kind: "postcode", label: "Buckingham Palace", postcode: "SW1A 1AA", outcode: "SW1A", region: "London", lat: 51.501, lng: -0.1416 },
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
      update: async (b) => void store.set(b.reference, b),
    },
    quoteRequests: memoryQuoteRequestRepository(),
    ...overrides,
  };
}

const LHR_T5 = { kind: "airport", airport: "LHR", terminal: "T5" } as const;
const at = (locationId: string, line1?: string) => ({ kind: "address" as const, locationId, ...(line1 ? { line1 } : {}) });

const journey: JourneyInput = {
  pickup: at("pc:SW1A 1AA"),
  dropoff: LHR_T5,
  extraStops: [],
  date: "2026-10-12",
  time: "06:30",
  passengers: 3,
  luggageCategory: "suitcases",
  largeItems: false,
};

const returnJourney: JourneyInput = {
  ...journey,
  tripType: "return",
  returnJourney: {
    pickup: LHR_T5,
    extraStops: [],
    date: "2026-10-19",
    time: "18:00",
    flightNumber: "BA123",
  },
};

// Test fixtures only — a made-up address and amounts, not real reference fares.
const estateFare: ReferenceFare = {
  id: "test-estate",
  status: "approved",
  pickup: { kind: "address", line1: "1 Example Road", postcode: "SW1A 1AA" },
  dropoff: { kind: "airport", airport: "LHR", terminal: "T5" },
  tripType: "one_way",
  referenceVehicle: "estate_car",
  confirmedParties: [{ passengers: 3, luggage: "suitcases" }],
  stops: [],
  extras: { meetAndGreet: false, childSeats: 0 },
  verifiedTravelDates: [{ outbound: "2026-10-12" }],
  currency: "GBP",
  vatIncluded: true,
  referenceTotalPence: 10000,
  checkedAt: "2026-10-04T10:00:00+01:00",
  checkedBy: "Test",
  approvedBy: "Owner",
  approvedAt: "2026-10-04T11:00:00+01:00",
};

const estateReturnFare: ReferenceFare = {
  ...estateFare,
  id: "test-estate-return",
  tripType: "return",
  returnLeg: { status: "confirmed", pickup: { kind: "airport", airport: "LHR", terminal: "T5" }, stops: [] },
  verifiedTravelDates: [{ outbound: "2026-10-12", return: "2026-10-19" }],
  referenceTotalPence: 20000,
};

const fares = [estateFare, estateReturnFare];

const NO_EXTRAS_FOR_TEST = { meetAndGreet: false, childSeats: 0 };

/** A server-priced journey matching the estate fixture fare, for testing the pricing step on its own. */
function journeyFor(luggageCategory: "none" | "hand_luggage" | "suitcases"): PricedJourney {
  return {
    pickup: { kind: "address", address: { ...places["pc:SW1A 1AA"], line1: "1 Example Road" } },
    dropoff: LHR_T5,
    tripType: "one_way",
    extraStops: [],
    date: "2026-10-12",
    time: "06:30",
    pickupAtUtc: "2026-10-12T05:30:00.000Z",
    passengers: 3,
    luggage: { large: 0, small: 0 },
    distanceMiles: 15,
    luggageCategory,
    largeItems: false,
    extras: NO_EXTRAS_FOR_TEST,
  };
}

describe("createQuote", () => {
  it("prices only vehicles with a matching approved fare: reference total minus £2", async () => {
    const result = await createQuote(journey, services(), { now, fares });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(result.quote.options.map((o) => [o.vehicleId, o]));
    expect(byId.estate).toMatchObject({ available: true, total: 9800, lines: [{ code: "fixed_fare", amount: 9800 }] });
    expect(byId.estate.pricing).toMatchObject({ status: "priced", fareId: "test-estate", referenceTotal: 10000 });
    // Unconfirmed fleet luggage limits aren't applied to a luggage category: only the fare decides.
    expect(byId.saloon).toMatchObject({ available: false, unavailableReason: "Price on request" });
    expect(byId.mpv).toMatchObject({ available: false, total: 0, unavailableReason: "Price on request" });
    expect(byId.mpv.pricing).toEqual({ status: "price_on_request", reason: "NO_MATCHING_FARE" });
    expect(result.quote.pricingVersion).toBe("reference-fares-2");
    expect(verifyQuote(result.token)?.journey.dropoff).toEqual(LHR_T5);
  });

  it("prices suitcases plus hand luggage exactly as suitcases, and keeps the hand luggage for the driver", async () => {
    const result = await createQuote({ ...journey, handLuggageToo: true }, services(), { now, fares });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const estate = result.quote.options.find((o) => o.vehicleId === "estate");
    expect(estate).toMatchObject({ available: true, total: 9800 });
    expect(result.quote.journey.handLuggageToo).toBe(true);
    expect(verifyQuote(result.token)?.journey.handLuggageToo).toBe(true);
  });

  it("drops the hand-luggage note unless the party also has suitcases", async () => {
    for (const luggageCategory of ["none", "hand_luggage"] as const) {
      const result = await createQuote({ ...journey, luggageCategory, handLuggageToo: true }, services(), { now, fares });
      expect(result.ok && result.quote.journey.handLuggageToo).toBe(undefined);
    }
    const plain = await createQuote(journey, services(), { now, fares });
    expect(plain.ok && plain.quote.journey.handLuggageToo).toBe(undefined);
  });

  it("keeps bag counts for the luggage chosen, without changing the price", async () => {
    const result = await createQuote(
      { ...journey, handLuggageToo: true, luggageCounts: { suitcases: 3, handLuggage: 2 } },
      services(),
      { now, fares },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.options.find((o) => o.vehicleId === "estate")).toMatchObject({ available: true, total: 9800 });
    expect(verifyQuote(result.token)?.journey.luggageCounts).toEqual({ suitcases: 3, handLuggage: 2 });
    // Counts for luggage that wasn't chosen are dropped.
    const handOnly = await createQuote({ ...journey, luggageCategory: "hand_luggage", luggageCounts: { suitcases: 3, handLuggage: 2 } }, services(), { now, fares });
    expect(handOnly.ok && handOnly.quote.journey.luggageCounts).toEqual({ handLuggage: 2 });
    const none = await createQuote({ ...journey, luggageCategory: "none", luggageCounts: { suitcases: 3 } }, services(), { now, fares });
    expect(none.ok && none.quote.journey.luggageCounts).toBe(undefined);
  });

  it("rejects a request without a luggage category, with no fallback to the fleet's luggage limits", async () => {
    const r = await createQuote({ ...journey, luggageCategory: undefined }, services(), { now, fares });
    expect(r.ok || [r.status, r.errors.map((e) => e.code)]).toEqual([422, ["LUGGAGE_CATEGORY_REQUIRED"]]);
  });

  it("rejects a request that doesn't say whether there are large items", async () => {
    const r = await createQuote({ ...journey, largeItems: undefined }, services(), { now, fares });
    expect(r.ok || r.errors.map((e) => e.code)).toEqual(["LARGE_ITEMS_REQUIRED"]);
  });

  it("never prices large or unusual items, even when a suitcases fare matches", async () => {
    const r = await createQuote({ ...journey, largeItems: true }, services(), { now, fares });
    expect(r.ok && r.quote.options.map((o) => [o.available, o.total, o.pricing])).toEqual(
      Array(5).fill([false, 0, { status: "price_on_request", reason: "LARGE_ITEMS" }]),
    );
  });

  it("can't book a quote declared with large items", async () => {
    const svc = services();
    const r = await createQuote({ ...journey, largeItems: true }, svc, { now, fares });
    if (!r.ok) throw new Error("quote failed");
    const b = await createBooking(
      {
        quoteToken: r.token,
        vehicleId: "estate",
        addOns: { meetAndGreet: false, childSeats: 0 },
        customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
        pickupLine1: "1 Example Road",
        expectedTotal: 9800,
      },
      svc,
      { now, fares },
    );
    expect(b.ok || b.errors[0].code).toBe("VEHICLE_UNAVAILABLE");
  });

  it("no longer uses the fleet's unconfirmed luggage limits to block or allow a vehicle", async () => {
    // The Saloon's stored "2 large cases" figure used to block 3 suitcases; it plays no part now.
    const result = await createQuote(journey, services(), { now, fares });
    const saloon = result.ok && result.quote.options.find((o) => o.vehicleId === "saloon");
    expect(saloon && [saloon.unavailableReason, saloon.pricing]).toEqual([
      "Price on request",
      { status: "price_on_request", reason: "NO_MATCHING_FARE" },
    ]);
  });

  it("never falls back to a tariff: with no fares every vehicle is price on request", async () => {
    const result = await createQuote(journey, services(), { now, fares: [] });
    expect(result.ok && result.quote.options.every((o) => !o.available && o.total === 0 && o.lines.length === 0)).toBe(true);
  });

  it("uses the shipped fare data by default, which is empty", async () => {
    const result = await createQuote(journey, services(), { now });
    expect(result.ok && result.quote.options.every((o) => o.pricing.status === "price_on_request")).toBe(true);
  });

  it("accepts only the three luggage categories at the API, and requires one", () => {
    const base = { ...journey, passengers: 3 };
    for (const luggageCategory of ["none", "hand_luggage", "suitcases"]) {
      expect(journeySchema.safeParse({ ...base, luggageCategory }).success).toBe(true);
    }
    for (const luggageCategory of ["bikes", "Suitcases", "", 2, null, undefined]) {
      expect(journeySchema.safeParse({ ...base, luggageCategory }).success).toBe(false);
    }
    const withoutCategory: Record<string, unknown> = { ...base };
    delete withoutCategory.luggageCategory;
    expect(journeySchema.safeParse(withoutCategory).success).toBe(false);
  });

  it("accepts an optional yes/no for hand luggage alongside the category", () => {
    for (const handLuggageToo of [true, false, undefined]) {
      expect(journeySchema.safeParse({ ...journey, handLuggageToo }).success).toBe(true);
    }
    for (const handLuggageToo of ["yes", 1, null]) {
      expect(journeySchema.safeParse({ ...journey, handLuggageToo }).success).toBe(false);
    }
  });

  it("accepts bag counts from 1 to the limit only", () => {
    expect(journeySchema.safeParse({ ...journey, luggageCounts: { suitcases: 1, handLuggage: 10 } }).success).toBe(true);
    for (const luggageCounts of [{ suitcases: 0 }, { handLuggage: 11 }, { suitcases: 1.5 }, { bikes: 1 }]) {
      expect(journeySchema.safeParse({ ...journey, luggageCounts }).success).toBe(false);
    }
  });

  it("requires a yes/no answer about large items at the API", () => {
    for (const largeItems of [true, false]) expect(journeySchema.safeParse({ ...journey, largeItems }).success).toBe(true);
    for (const largeItems of [undefined, null, "no", 0]) expect(journeySchema.safeParse({ ...journey, largeItems }).success).toBe(false);
  });

  it("refuses old luggage-count requests at the API", () => {
    const legacy = { ...journey, luggageCategory: undefined, luggage: { large: 3, small: 1 } };
    expect(journeySchema.safeParse(legacy).success).toBe(false);
    // Even alongside a valid category, old count fields are refused rather than ignored.
    expect(journeySchema.safeParse({ ...journey, luggage: { large: 3, small: 1 } }).success).toBe(false);
    const oldCounts = { standardSuitcases: 2, smallHandLuggage: 0, regularHandLuggage: 0, otherItems: 0 };
    expect(journeySchema.safeParse({ ...journey, referenceLuggage: oldCounts }).success).toBe(false);
  });

  it("rejects an invalid category that bypasses the API schema", async () => {
    const r = await createQuote({ ...journey, luggageCategory: "bikes" as never }, services(), { now, fares });
    expect(r.ok || r.errors.map((e) => e.code)).toEqual(["LUGGAGE_CATEGORY_REQUIRED"]);
  });

  it("prices only the luggage category and passenger count the fare was confirmed for", async () => {
    const estateOf = async (input: JourneyInput) => {
      const r = await createQuote(input, services(), { now, fares });
      return r.ok ? r.quote.options.find((o) => o.vehicleId === "estate")!.pricing : null;
    };
    expect(await estateOf(journey)).toMatchObject({ status: "priced", referenceTotal: 10000 });
    expect(await estateOf({ ...journey, luggageCategory: "hand_luggage" })).toEqual({ status: "price_on_request", reason: "PARTY_UNCONFIRMED" });
    expect(await estateOf({ ...journey, luggageCategory: "none" })).toEqual({ status: "price_on_request", reason: "PARTY_UNCONFIRMED" });
    expect(await estateOf({ ...journey, passengers: 2 })).toEqual({ status: "price_on_request", reason: "PARTY_UNCONFIRMED" });
  });

  it("prices nothing if the pricing step is reached without a luggage category", () => {
    const quoted = { ...journeyFor("suitcases"), luggageCategory: undefined };
    expect(priceVehicle(quoted, "estate", quoted.extras, fares, now).pricing).toEqual({
      status: "price_on_request",
      reason: "PARTY_UNCONFIRMED",
    });
  });

  it("treats a missing large-items answer at the pricing step as large items", () => {
    const quoted = { ...journeyFor("suitcases"), largeItems: undefined };
    expect(priceVehicle(quoted, "estate", quoted.extras, fares, now).pricing).toEqual({
      status: "price_on_request",
      reason: "LARGE_ITEMS",
    });
    expect(priceVehicle(journeyFor("suitcases"), "estate", NO_EXTRAS_FOR_TEST, fares, now)).toMatchObject({ total: 9800 });
  });

  it("prices nothing for a named area without a postcode", async () => {
    const result = await createQuote({ ...journey, pickup: at("pl:camden") }, services(), { now, fares });
    expect(result.ok && result.quote.options.every((o) => o.pricing.status === "price_on_request")).toBe(true);
  });

  it("prices only the extras the fare was checked with", async () => {
    const result = await createQuote({ ...journey, extras: { meetAndGreet: false, childSeats: 1 } }, services(), { now, fares });
    const estate = result.ok && result.quote.options.find((o) => o.vehicleId === "estate");
    expect(estate && estate.pricing).toEqual({ status: "price_on_request", reason: "EXTRAS_MISMATCH" });
  });

  it("takes £2 off a return total once", async () => {
    const result = await createQuote(returnJourney, services(), { now, fares });
    const estate = result.ok && result.quote.options.find((o) => o.vehicleId === "estate");
    expect(estate).toMatchObject({ available: true, total: 19800, lines: [{ label: "Fixed return fare", amount: 19800 }] });
  });

  it("holds the quote no longer than the fare stays valid", async () => {
    const late = new Date("2026-10-11T09:45:00+01:00"); // fare valid until 10:00
    const result = await createQuote(journey, services(), { now: late, fares });
    expect(result.ok && result.quote.expiresAt).toBe("2026-10-11T09:00:00.000Z");
  });

  it("validates the return journey", async () => {
    const code = async (input: JourneyInput) => {
      const r = await createQuote(input, services(), { now, fares });
      return r.ok ? [] : r.errors.map((e) => `${e.field}:${e.code}`);
    };
    expect(await code({ ...returnJourney, returnJourney: undefined })).toEqual(["returnJourney:RETURN_JOURNEY_REQUIRED"]);
    const back = returnJourney.returnJourney!;
    expect(await code({ ...returnJourney, returnJourney: { ...back, date: "2026-10-12", time: "06:00" } })).toEqual([
      "returnJourney.date:RETURN_BEFORE_OUTBOUND",
    ]);
    expect(
      await code({ ...returnJourney, returnJourney: { ...back, pickup: { kind: "airport", airport: "LHR" }, flightNumber: undefined } }),
    ).toEqual(["returnJourney.pickup.terminal:TERMINAL_REQUIRED", "returnJourney.flightNumber:FLIGHT_NUMBER_REQUIRED"]);
    expect(await code({ ...returnJourney, returnJourney: { ...back, pickup: at("pc:OX1 1AA") } })).toEqual([
      "returnJourney.pickup:ADDRESS_OUTSIDE_AREA",
    ]);
  });

  it("rejects addresses outside the service area", async () => {
    const r = await createQuote({ ...journey, pickup: at("pc:OX1 1AA") }, services(), { now, fares });
    expect(r.ok || r.errors.map((e) => `${e.field}:${e.code}`)).toEqual(["pickup:ADDRESS_OUTSIDE_AREA"]);
  });

  it("rejects airport-to-airport journeys before any lookup", async () => {
    const resolve = vi.fn();
    const svc = services({ locations: { ...locations, resolve } });
    const r = await createQuote({ ...journey, pickup: { kind: "airport", airport: "LGW", terminal: "N" }, flightNumber: "BA123" }, svc, { now, fares });
    expect(r.ok || r.errors.map((e) => `${e.field}:${e.code}`)).toEqual(["dropoff:ROUTE_UNSUPPORTED"]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("checks an address next to an airport like any other address, with no distance rule", async () => {
    // Gatwick's own postcode is outside Greater London, so as an address it's outside the area…
    const gatwick = await createQuote({ ...journey, pickup: at("pc:RH6 0NP") }, services(), { now, fares });
    expect(gatwick.ok || gatwick.errors.map((e) => e.code)).toEqual(["ADDRESS_OUTSIDE_AREA"]);
    // …while a Heathrow postcode is in London and is accepted, as an ordinary address, as a pickup or a stop.
    const heathrow = await createQuote({ ...journey, pickup: at("pc:TW6 2GA") }, services(), { now, fares });
    expect(heathrow.ok && heathrow.quote.journey.pickup).toMatchObject({ kind: "address", address: { postcode: "TW6 2GA" } });
    const stop = await createQuote({ ...journey, extraStops: [{ locationId: "pc:TW6 2GA" }] }, services(), { now, fares });
    expect(stop.ok).toBe(true);
  });

  it("reports lookup failures distinctly", async () => {
    const failing = services({
      locations: { ...locations, resolve: async () => Promise.reject(new LocationLookupError("down")) },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await createQuote(journey, failing, { now, fares });
    expect(r.ok || [r.status, r.errors[0].code]).toEqual([502, "LOCATION_LOOKUP_FAILED"]);
  });

  it("validates before doing any lookups", async () => {
    const resolve = vi.fn();
    const noTerminal = { ...journey, dropoff: { kind: "airport" as const, airport: "LHR" as const } };
    const r = await createQuote(noTerminal, services({ locations: { ...locations, resolve } }), { now, fares });
    expect(r.ok || r.errors.map((e) => `${e.field}:${e.code}`)).toEqual(["dropoff.terminal:TERMINAL_REQUIRED"]);
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("createBooking", () => {
  async function quoteFor(input: JourneyInput, svc: Services, at = now) {
    const r = await createQuote(input, svc, { now: at, fares });
    if (!r.ok) throw new Error("quote failed");
    return r;
  }

  const request = (token: string, expectedTotal: number): BookingRequest => ({
    quoteToken: token,
    vehicleId: "estate",
    addOns: { meetAndGreet: false, childSeats: 0 },
    customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
    pickupLine1: "1 Example Road",
    expectedTotal,
  });

  it("creates a booking at the server's reference-fare price and notifies", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const r = await createBooking(request(token, 9800), svc, { now, fares });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking.reference).toMatch(/^GAT-[2-9A-HJKMNP-Z]{6}$/);
    expect(r.booking).toMatchObject({
      status: "received",
      total: 9800,
      lines: [{ code: "fixed_fare", amount: 9800 }],
      referenceFare: { id: "test-estate", referenceTotal: 10000, checkedAt: estateFare.checkedAt },
      pricingVersion: "reference-fares-2",
    });
    expect(r.booking.reviewFlags).toBeUndefined();
    expect(await svc.bookings.exists(r.booking.reference)).toBe(true);
    expect(svc.notifier.bookingReceived).toHaveBeenCalledOnce();
  });

  it("books a return at the return total minus £2, once", async () => {
    const svc = services();
    const { token } = await quoteFor(returnJourney, svc);
    const r = await createBooking(request(token, 19800), svc, { now, fares });
    expect(r.ok && [r.booking.total, r.booking.journey.returnJourney?.pickup]).toEqual([19800, LHR_T5]);
    expect(r.ok && r.booking.journey.pickup).toMatchObject({ kind: "address", address: { line1: "1 Example Road" } });
  });

  it("refuses a tampered quote", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const r = await createBooking(request(token.replace(/.$/, "x"), 9800), svc, { now, fares });
    expect(r.ok || r.errors[0].code).toBe("QUOTE_INVALID");
  });

  it("refuses an expired quote", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const later = new Date(now.getTime() + 31 * 60_000);
    const r = await createBooking(request(token, 9800), svc, { now: later, fares });
    expect(r.ok || r.errors[0].code).toBe("QUOTE_EXPIRED");
  });

  it("refuses quotes signed under the old placeholder pricing", async () => {
    const svc = services();
    const { quote } = await quoteFor(journey, svc);
    const old: Quote = { ...quote, pricingVersion: "placeholder-2026-10-05" };
    const r = await createBooking(request(signQuote(old), 9800), svc, { now, fares });
    expect(r.ok || r.errors[0].code).toBe("QUOTE_EXPIRED");
  });

  it("never trusts a price from the client, even inside a validly signed quote", async () => {
    const svc = services();
    const { quote } = await quoteFor(journey, svc);
    const forged: Quote = {
      ...quote,
      options: quote.options.map((o) => (o.vehicleId === "estate" ? { ...o, total: 100, lines: [{ ...o.lines[0], amount: 100 }] } : o)),
    };
    const r = await createBooking(request(signQuote(forged), 100), svc, { now, fares });
    expect(r.ok || [r.errors[0].code, r.total]).toEqual(["PRICE_CHANGED", 9800]);
  });

  it("refuses when the customer saw a different total, and reports the server's", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const r = await createBooking(request(token, 9600), svc, { now, fares });
    expect(r.ok || [r.errors[0].code, r.total]).toEqual(["PRICE_CHANGED", 9800]);
  });

  it("refuses when the fare has been removed since the quote", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await createBooking(request(token, 9800), svc, { now, fares: [] });
    expect(r.ok || [r.status, r.errors[0].code]).toEqual([409, "FARE_UNAVAILABLE"]);
  });

  it("refuses when the fare is no longer approved", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const pending = { ...estateFare, status: "pending" as const, approvedBy: "", approvedAt: null };
    const r = await createBooking(request(token, 9800), svc, { now, fares: [pending] });
    expect(r.ok || r.errors[0].code).toBe("FARE_UNAVAILABLE");
  });

  it("refuses when a second fare makes the match ambiguous", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await createBooking(request(token, 9800), svc, { now, fares: [estateFare, { ...estateFare, id: "copy" }] });
    expect(r.ok || r.errors[0].code).toBe("FARE_UNAVAILABLE");
  });

  it("refuses when the fare amount has changed since the quote", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const r = await createBooking(request(token, 9800), svc, { now, fares: [{ ...estateFare, referenceTotalPence: 10500 }] });
    expect(r.ok || [r.errors[0].code, r.total]).toEqual(["PRICE_CHANGED", 10300]);
  });

  it("refuses once the fare's 7 days have run out", async () => {
    const svc = services();
    const late = new Date("2026-10-11T09:45:00+01:00");
    const { token } = await quoteFor(journey, svc, late);
    const r = await createBooking(request(token, 9800), svc, { now: new Date("2026-10-11T10:00:00+01:00"), fares });
    expect(r.ok || r.errors[0].code).toBe("QUOTE_EXPIRED");
  });

  it("refuses a different house number on the quoted postcode", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await createBooking({ ...request(token, 9800), pickupLine1: "7 Example Road" }, svc, { now, fares });
    expect(r.ok || r.errors[0].code).toBe("FARE_UNAVAILABLE");
  });

  it("re-quotes a different house number as price on request, so the customer isn't offered the same price again", async () => {
    const r = await createQuote({ ...journey, pickup: at("pc:SW1A 1AA", "7 Example Road") }, services(), { now, fares });
    const estate = r.ok && r.quote.options.find((o) => o.vehicleId === "estate");
    expect(estate && estate.pricing).toEqual({ status: "price_on_request", reason: "ADDRESS_MISMATCH" });
  });

  it("refuses extras that weren't part of the quoted price", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const r = await createBooking({ ...request(token, 9800), addOns: { meetAndGreet: false, childSeats: 1 } }, svc, { now, fares });
    expect(r.ok || [r.errors[0].field, r.errors[0].code]).toEqual(["addOns", "PRICE_CHANGED"]);
  });

  it("refuses a vehicle that can't carry the group, or has no price", async () => {
    const svc = services();
    const { token } = await quoteFor(journey, svc);
    const saloon = await createBooking({ ...request(token, 9800), vehicleId: "saloon" }, svc, { now, fares });
    const mpv = await createBooking({ ...request(token, 9800), vehicleId: "mpv" }, svc, { now, fares });
    expect(saloon.ok || saloon.errors[0].code).toBe("VEHICLE_UNAVAILABLE");
    expect(mpv.ok || mpv.errors[0].code).toBe("VEHICLE_UNAVAILABLE");
  });

  it("can't book a named area, which has no price", async () => {
    const svc = services();
    const { token } = await quoteFor({ ...journey, pickup: at("pl:camden") }, svc);
    const r = await createBooking(request(token, 9800), svc, { now, fares });
    expect(r.ok || r.errors.map((e) => e.code)).toEqual(["VEHICLE_UNAVAILABLE"]);
  });

  describe("when the booking can't be saved", () => {
    const unavailable = "We couldn’t save your booking, so it has not been made. Please call us on +44 7470 046660 to book.";

    it.each([
      ["storage isn't configured", unavailableBookingRepository()],
      ["the database returns an error", { ...services().bookings, create: async () => Promise.reject(new BookingStorageError("Booking save failed", "08006")) }],
      ["the connection throws", { ...services().bookings, create: async () => Promise.reject(new TypeError("fetch failed")) }],
    ])("refuses it when %s: no reference, no email, no success", async (_label, bookings) => {
      const svc = services({ bookings });
      const { token } = await quoteFor(journey, svc);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const r = await createBooking(request(token, 9800), svc, { now, fares });
      expect(r.ok).toBe(false);
      expect(r.ok || [r.status, r.errors]).toEqual([503, [{ field: "request", code: "BOOKING_UNAVAILABLE", message: unavailable }]]);
      expect(r).not.toHaveProperty("booking");
      expect(svc.notifier.bookingReceived).not.toHaveBeenCalled();
      // Nothing about the customer goes into the log.
      const logged = log.mock.calls.flat().join(" ");
      expect(logged).not.toMatch(/Sam|sam@example.com|07700|Example Road/);
    });

    it("tries a new reference when one is already taken", async () => {
      const saved: string[] = [];
      let clashes = 2;
      const svc = services({
        bookings: {
          ...services().bookings,
          create: async (b) => {
            if (clashes-- > 0) throw new BookingReferenceTakenError();
            saved.push(b.reference);
          },
        },
      });
      const { token } = await quoteFor(journey, svc);
      const r = await createBooking(request(token, 9800), svc, { now, fares });
      expect(r.ok && r.booking.reference).toBe(saved[0]);
      expect(svc.notifier.bookingReceived).toHaveBeenCalledOnce();
    });

    it("gives up after repeated reference clashes and asks the customer to call", async () => {
      const svc = services({ bookings: { ...services().bookings, create: async () => Promise.reject(new BookingReferenceTakenError()) } });
      const { token } = await quoteFor(journey, svc);
      vi.spyOn(console, "error").mockImplementation(() => {});
      const r = await createBooking(request(token, 9800), svc, { now, fares });
      expect(r.ok || r.errors[0].code).toBe("BOOKING_UNAVAILABLE");
      expect(svc.notifier.bookingReceived).not.toHaveBeenCalled();
    });
  });

  it("keeps the booking when the notification fails", async () => {
    const svc = services({ notifier: { bookingReceived: async () => Promise.reject(new Error("smtp")), contactEnquiry: async () => {} } });
    const { token } = await quoteFor(journey, svc);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await createBooking(request(token, 9800), svc, { now, fares });
    expect(r.ok).toBe(true);
  });
});

describe("point-to-point journeys", () => {
  // Test fixtures only — made-up addresses and amounts, not real reference fares.
  const a2a: JourneyInput = { ...journey, pickup: at("pc:SW1A 1AA"), dropoff: at("pc:EC1A 1BB") };
  const a2aFare: ReferenceFare = {
    ...estateFare,
    id: "test-a2a",
    pickup: { kind: "address", line1: "1 Example Road", postcode: "SW1A 1AA" },
    dropoff: { kind: "address", line1: "5 Office Lane", postcode: "EC1A 1BB" },
    referenceTotalPence: 4500,
  };
  const a2aReturnFare: ReferenceFare = {
    ...a2aFare,
    id: "test-a2a-return",
    tripType: "return",
    returnLeg: { status: "confirmed", pickup: { kind: "address", line1: "5 Office Lane", postcode: "EC1A 1BB" }, stops: [] },
    verifiedTravelDates: [{ outbound: "2026-10-12", return: "2026-10-19" }],
    referenceTotalPence: 9000,
  };
  const fromAirport: JourneyInput = { ...journey, pickup: LHR_T5, dropoff: at("pc:SW1A 1AA"), flightNumber: "BA2490" };
  const fromAirportFare: ReferenceFare = {
    ...estateFare,
    id: "test-from-lhr",
    pickup: { kind: "airport", airport: "LHR", terminal: "T5" },
    dropoff: { kind: "address", line1: "1 Example Road", postcode: "SW1A 1AA" },
    extras: { meetAndGreet: true, childSeats: 0 },
    referenceTotalPence: 11000,
  };
  const p2pFares = [a2aFare, a2aReturnFare, fromAirportFare];
  const ret = (pickup: JourneyInput["dropoff"], extra: Partial<NonNullable<JourneyInput["returnJourney"]>> = {}) => ({
    tripType: "return" as const,
    returnJourney: { pickup, extraStops: [], date: "2026-10-19", time: "18:00", ...extra },
  });

  const quote = (input: JourneyInput, fareData = p2pFares) => createQuote(input, services(), { now, fares: fareData });
  const codes = async (input: JourneyInput) => {
    const r = await quote(input);
    return r.ok ? [] : r.errors.map((e) => `${e.field}:${e.code}`);
  };
  const estate = async (input: JourneyInput) => {
    const r = await quote(input);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    return r.quote.options.find((o) => o.vehicleId === "estate")!;
  };

  it("works out the three journey kinds from the ends", async () => {
    for (const input of [journey, fromAirport, a2a]) expect(await codes(input)).toEqual([]);
    const r = await quote(a2a);
    expect(r.ok && [r.quote.journey.pickup.kind, r.quote.journey.dropoff.kind]).toEqual(["address", "address"]);
  });

  it("prices an address-to-address journey only from an exact approved fare: reference total minus £2", async () => {
    expect(await estate(a2a)).toMatchObject({ available: true, total: 4300, pricing: { fareId: "test-a2a", referenceTotal: 4500 } });
    // The same two places the other way round are a different journey.
    expect((await estate({ ...a2a, pickup: at("pc:EC1A 1BB"), dropoff: at("pc:SW1A 1AA") })).pricing).toEqual({
      status: "price_on_request",
      reason: "NO_MATCHING_FARE",
    });
    // With no fares at all, nothing is priced.
    const empty = await quote(a2a, []);
    expect(empty.ok && empty.quote.options.every((o) => !o.available && o.total === 0)).toBe(true);
  });

  it("checks both address ends against Greater London, and lets the airports through", async () => {
    expect(await codes({ ...a2a, dropoff: at("pc:OX1 1AA") })).toEqual(["dropoff:ADDRESS_OUTSIDE_AREA"]);
    expect(await codes({ ...journey, dropoff: { kind: "airport", airport: "STN" } })).toEqual([]);
    expect(await codes({ ...fromAirport, pickup: { kind: "airport", airport: "LTN" } })).toEqual([]);
  });

  it("refuses a journey that starts where it ends", async () => {
    expect(await codes({ ...a2a, dropoff: at("pc:SW1A 1AA") })).toEqual(["dropoff:SAME_LOCATION"]);
    // A different search result with the same postcode is the same place.
    expect(await codes({ ...a2a, dropoff: at("alt:palace") })).toEqual(["dropoff:SAME_LOCATION"]);
  });

  it("allows up to two stops per leg, inside the area, and none repeated or at either end", async () => {
    const stop = (id: string) => ({ locationId: id });
    expect(await codes({ ...a2a, extraStops: [stop("pc:E1 6AN"), stop("pc:W1A 1AA")] })).toEqual([]);
    expect(await codes({ ...a2a, extraStops: [stop("pc:E1 6AN"), stop("pc:W1A 1AA"), stop("pc:NW1 8NH")] })).toEqual([
      "extraStops:STOP_LIMIT",
    ]);
    expect(await codes({ ...a2a, extraStops: [stop("pc:E1 6AN"), stop("pc:E1 6AN")] })).toEqual(["extraStops.1:STOP_DUPLICATE"]);
    expect(await codes({ ...a2a, extraStops: [stop("pc:EC1A 1BB")] })).toEqual(["extraStops.0:STOP_SAME_LOCATION"]);
    expect(await codes({ ...a2a, extraStops: [stop("alt:palace")] })).toEqual(["extraStops.0:STOP_SAME_LOCATION"]);
    expect(await codes({ ...a2a, extraStops: [stop("pc:OX1 1AA")] })).toEqual(["extraStops.0:ADDRESS_OUTSIDE_AREA"]);
    // The way back has its own two.
    const back = ret(at("pc:EC1A 1BB"), { extraStops: [stop("pc:E1 6AN"), stop("pc:W1A 1AA")] });
    expect(await codes({ ...a2a, extraStops: [stop("pc:NW1 8NH"), stop("pc:W1A 1AA")], ...back })).toEqual([]);
    const tooMany = ret(at("pc:EC1A 1BB"), { extraStops: [stop("pc:E1 6AN"), stop("pc:W1A 1AA"), stop("pc:NW1 8NH")] });
    expect(await codes({ ...a2a, ...tooMany })).toEqual(["returnJourney.extraStops:STOP_LIMIT"]);
    // A stop on the way back can't be the return pickup or the outward pickup it ends at.
    expect(await codes({ ...a2a, ...ret(at("pc:EC1A 1BB"), { extraStops: [stop("pc:SW1A 1AA")] }) })).toEqual([
      "returnJourney.extraStops.0:STOP_SAME_LOCATION",
    ]);
  });

  it("matches stops exactly, in order", async () => {
    const withStop = { ...a2aFare, id: "test-a2a-stop", stops: ["E1 6AN"] };
    const r = await createQuote({ ...a2a, extraStops: [{ locationId: "pc:E1 6AN" }] }, services(), { now, fares: [withStop] });
    expect(r.ok && r.quote.options.find((o) => o.vehicleId === "estate")?.total).toBe(4300);
    const other = await createQuote({ ...a2a, extraStops: [{ locationId: "pc:W1A 1AA" }] }, services(), { now, fares: [withStop] });
    expect(other.ok && other.quote.options.find((o) => o.vehicleId === "estate")?.pricing).toEqual({
      status: "price_on_request",
      reason: "STOPS_MISMATCH",
    });
  });

  it("returns to the outward pickup, from the outward drop-off by default, with £2 off the return total once", async () => {
    const r = await quote({ ...a2a, ...ret(at("pc:EC1A 1BB")) });
    expect(r.ok && r.quote.options.find((o) => o.vehicleId === "estate")).toMatchObject({ total: 8800, pricing: { fareId: "test-a2a-return" } });
    expect(r.ok && r.quote.journey.returnJourney?.pickup).toMatchObject({ kind: "address", address: { postcode: "EC1A 1BB" } });
  });

  it("lets the way back start at another Greater London address", async () => {
    expect(await codes({ ...a2a, ...ret(at("pc:E1 6AN")) })).toEqual([]);
    // It's priced only if the fare's confirmed return route starts there too.
    expect((await estate({ ...a2a, ...ret(at("pc:E1 6AN")) })).pricing).toEqual({ status: "price_on_request", reason: "RETURN_ROUTE_MISMATCH" });
    expect(await codes({ ...a2a, ...ret(at("pc:OX1 1AA")) })).toEqual(["returnJourney.pickup:ADDRESS_OUTSIDE_AREA"]);
    // Collecting from the outward pickup would be a return that goes nowhere.
    expect(await codes({ ...a2a, ...ret(at("pc:SW1A 1AA")) })).toEqual(["returnJourney.pickup:SAME_LOCATION"]);
  });

  it("lets the way back start at another terminal of the same airport, but never at another airport", async () => {
    const back = { flightNumber: "BA123" };
    expect(await codes({ ...journey, ...ret({ kind: "airport", airport: "LHR", terminal: "T3" }, back) })).toEqual([]);
    expect(await codes({ ...journey, ...ret({ kind: "airport", airport: "LGW", terminal: "N" }, back) })).toEqual([
      "returnJourney.pickup:RETURN_PICKUP_INVALID",
    ]);
  });

  it("never starts the way back at an airport when the outward journey ended at an address", async () => {
    expect(await codes({ ...a2a, ...ret(LHR_T5, { flightNumber: "BA123" }) })).toEqual(["returnJourney.pickup:RETURN_PICKUP_INVALID"]);
    // Out from the airport, back from the same airport, would be airport to airport.
    expect(await codes({ ...fromAirport, ...ret(LHR_T5, { flightNumber: "BA123" }) })).toEqual(["returnJourney.pickup:RETURN_PICKUP_INVALID"]);
  });

  it("needs a flight number only when collecting from an airport, and keeps none for address-only legs", async () => {
    expect(await codes({ ...fromAirport, flightNumber: undefined })).toEqual(["flightNumber:FLIGHT_NUMBER_REQUIRED"]);
    expect(await codes({ ...journey, flightNumber: undefined })).toEqual([]);
    const r = await quote({ ...a2a, flightNumber: "BA2490" });
    expect(r.ok && r.quote.journey.flightNumber).toBeUndefined();
  });

  it("offers Meet & Greet only where a leg starts at an airport, once per booking", async () => {
    const withMeet = { meetAndGreet: true, childSeats: 0 };
    const extrasOf = async (input: JourneyInput) => {
      const r = await quote({ ...input, extras: withMeet });
      return r.ok && r.quote.journey.extras.meetAndGreet;
    };
    expect(await extrasOf(fromAirport)).toBe(true);
    expect(await extrasOf({ ...journey, ...ret(LHR_T5, { flightNumber: "BA123" }) })).toBe(true);
    expect(await extrasOf(journey)).toBe(false);
    expect(await extrasOf(a2a)).toBe(false);
    expect(await extrasOf({ ...a2a, ...ret(at("pc:EC1A 1BB")) })).toBe(false);
    // Out to the airport, but collected from another address on the way back: no airport pickup at all.
    expect(await extrasOf({ ...journey, ...ret(at("pc:E1 6AN")) })).toBe(false);
    // Priced only when the fare includes it.
    const meet = await quote({ ...fromAirport, extras: withMeet });
    expect(meet.ok && meet.quote.options.find((o) => o.vehicleId === "estate")).toMatchObject({ total: 10800 });
  });

  it("offers up to three child seats on any journey, priced only when the fare includes them", async () => {
    const seats = (childSeats: number) => ({ ...a2a, extras: { meetAndGreet: false, childSeats } });
    expect(await codes(seats(3))).toEqual([]);
    expect((await estate(seats(1))).pricing).toEqual({ status: "price_on_request", reason: "EXTRAS_MISMATCH" });
    const r = await createQuote(seats(1), services(), { now, fares: [{ ...a2aFare, extras: { meetAndGreet: false, childSeats: 1 } }] });
    expect(r.ok && r.quote.options.find((o) => o.vehicleId === "estate")?.total).toBe(4300);
  });

  it("gives areas without a postcode a price on request only, at either end", async () => {
    for (const input of [{ ...a2a, dropoff: at("pl:camden") }, { ...a2a, pickup: at("pl:camden") }]) {
      const r = await quote(input);
      expect(r.ok && r.quote.options.every((o) => o.pricing.status === "price_on_request")).toBe(true);
    }
  });

  it("still never prices large items or unconfirmed parties", async () => {
    expect((await estate({ ...a2a, largeItems: true })).pricing).toEqual({ status: "price_on_request", reason: "LARGE_ITEMS" });
    expect((await estate({ ...a2a, passengers: 2 })).pricing).toEqual({ status: "price_on_request", reason: "PARTY_UNCONFIRMED" });
  });

  it("refuses old airport-and-direction requests at the API", () => {
    const legacy = {
      direction: "to_airport",
      airport: "LHR",
      terminal: "T5",
      address: { locationId: "pc:SW1A 1AA" },
      extraStops: [],
      date: "2026-10-12",
      time: "06:30",
      passengers: 3,
      luggageCategory: "suitcases",
      largeItems: false,
    };
    expect(journeySchema.safeParse(legacy).success).toBe(false);
    expect(journeySchema.safeParse({ ...a2a }).success).toBe(true);
    expect(journeySchema.safeParse({ ...a2a, direction: "to_airport" }).success).toBe(false);
    expect(journeySchema.safeParse({ ...a2a, pickup: { kind: "address", locationId: "pc:SW1A 1AA", postcode: "SW1A 1AA" } }).success).toBe(false);
    expect(journeySchema.safeParse({ ...a2a, pickup: { kind: "station", locationId: "x" } }).success).toBe(false);
    expect(journeySchema.safeParse({ ...a2a, ...ret(at("pc:E1 6AN")), returnJourney: { address: { locationId: "x" } } }).success).toBe(false);
  });

  describe("booking", () => {
    const book = (token: string, total: number, extra: Partial<BookingRequest> = {}) =>
      createBooking(
        {
          quoteToken: token,
          vehicleId: "estate",
          addOns: { meetAndGreet: false, childSeats: 0 },
          customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
          pickupLine1: "1 Example Road",
          dropoffLine1: "5 Office Lane",
          expectedTotal: total,
          ...extra,
        },
        svc,
        { now, fares: p2pFares },
      );
    let svc: Services;
    const tokenFor = async (input: JourneyInput) => {
      svc = services();
      const r = await createQuote(input, svc, { now, fares: p2pFares });
      if (!r.ok) throw new Error("quote failed");
      return r.token;
    };

    it("books an address-to-address journey after re-checking the fare with both house numbers", async () => {
      const r = await book(await tokenFor(a2a), 4300);
      expect(r.ok && [r.booking.total, r.booking.referenceFare?.id, r.booking.reviewFlags]).toEqual([4300, "test-a2a", undefined]);
      expect(r.ok && [r.booking.journey.pickup, r.booking.journey.dropoff]).toMatchObject([
        { kind: "address", address: { line1: "1 Example Road" } },
        { kind: "address", address: { line1: "5 Office Lane" } },
      ]);
      expect(r.ok && r.booking.flightCheck).toEqual({ status: "unverified" });
    });

    it("needs a house number and street for every address end", async () => {
      const token = await tokenFor(a2a);
      const r = await book(token, 4300, { pickupLine1: "", dropoffLine1: " " });
      expect(r.ok || r.errors.map((e) => `${e.field}:${e.code}`)).toEqual([
        "pickupLine1:ADDRESS_LINE_REQUIRED",
        "dropoffLine1:ADDRESS_LINE_REQUIRED",
      ]);
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const wrong = await book(token, 4300, { dropoffLine1: "9 Office Lane" });
      expect(wrong.ok || wrong.errors[0].code).toBe("FARE_UNAVAILABLE");
    });

    it("reuses the drop-off address for a return collected there, and needs its own for one collected elsewhere", async () => {
      const same = await book(await tokenFor({ ...a2a, ...ret(at("pc:EC1A 1BB")) }), 8800);
      expect(same.ok && same.booking.journey.returnJourney?.pickup).toMatchObject({ kind: "address", address: { line1: "5 Office Lane" } });

      const elsewhere = await tokenFor({ ...a2a, ...ret(at("pc:E1 6AN")) });
      // Not priced (no fare starts the way back there), so it can't be booked either way.
      const r = await book(elsewhere, 0);
      expect(r.ok || r.errors.map((e) => e.code)).toEqual(["ADDRESS_LINE_REQUIRED", "VEHICLE_UNAVAILABLE"]);
      expect(r.ok || r.errors[0].field).toBe("returnPickupLine1");
    });

    it("records Meet & Greet only where a leg starts at an airport", async () => {
      const r = await book(await tokenFor(a2a), 4300, { addOns: { meetAndGreet: true, childSeats: 0 } });
      expect(r.ok && r.booking.addOns).toEqual({ meetAndGreet: false, childSeats: 0 });
      const meet = await book(await tokenFor({ ...fromAirport, extras: { meetAndGreet: true, childSeats: 0 } }), 10800, {
        addOns: { meetAndGreet: true, childSeats: 0 },
        pickupLine1: undefined,
        dropoffLine1: "1 Example Road",
      });
      expect(meet.ok && meet.booking.addOns.meetAndGreet).toBe(true);
    });

    it("can't book an unmatched journey: it stays price on request", async () => {
      const r = await book(await tokenFor({ ...a2a, dropoff: at("pc:W1A 1AA") }), 4300);
      expect(r.ok || r.errors.map((e) => e.code)).toEqual(["VEHICLE_UNAVAILABLE"]);
    });

    it("refuses quotes signed before journeys had a pickup and a drop-off", async () => {
      const r = await createQuote(a2a, services(), { now, fares: p2pFares });
      if (!r.ok) throw new Error("quote failed");
      svc = services();
      const old = signQuote({ ...r.quote, pricingVersion: "reference-fares-1" });
      const b = await book(old, 4300);
      expect(b.ok || b.errors[0].code).toBe("QUOTE_EXPIRED");
    });
  });
});

describe("location tariff", () => {
  // Test figures only: not Galaxy's rates.
  const flat = { baseFare: 4000, includedMiles: 10, perMile: 200, minimumFare: 4500, dropOffCharge: 0, pickupParking: 0 };
  const tariff: PricingConfig = {
    version: "test-tariff-1",
    isPlaceholder: false,
    roundTo: 100,
    airports: { LHR: flat, LGW: flat, STN: flat, LTN: flat, LCY: flat },
    vehicleMultipliers: { saloon: 1, estate: 1.2, executive: 1.5, mpv: 1.4, minibus: 1.8 },
    extras: { meetAndGreet: 1500, childSeat: 800, extraStop: 1000 },
    timeSurcharges: [],
    eventSurcharges: [{ label: "Christmas rate", from: { date: "12-24", time: "18:00" }, to: { date: "12-26", time: "23:59" }, multiplier: 2, enabled: true }],
  };
  const opts = { now, fares, tariff };

  it("prices every vehicle with room where no reference fare matches", async () => {
    const r = await createQuote({ ...journey, passengers: 2, luggageCategory: "hand_luggage" }, services(), opts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const saloon = r.quote.options.find((o) => o.vehicleId === "saloon")!;
    const expected = journeyFare({ direction: "to_airport", airport: "LHR", vehicleId: "saloon", distanceMiles: r.quote.journey.distanceMiles, time: "06:30", extraStops: 0 }, tariff);
    expect(saloon).toMatchObject({ available: true, total: expected, pricing: { status: "tariff", tariffVersion: "test-tariff-1", events: [] } });
    expect(r.quote.options.every((o) => o.available)).toBe(true);
  });

  it("still uses a matching reference fare (minus £2) ahead of the tariff", async () => {
    const r = await createQuote(journey, services(), opts);
    const estate = r.ok && r.quote.options.find((o) => o.vehicleId === "estate");
    expect(estate).toMatchObject({ total: 9800, pricing: { status: "priced", fareId: "test-estate" } });
  });

  it("refuses vehicles too small for the party", async () => {
    const r = await createQuote({ ...journey, passengers: 5 }, services(), opts);
    const byId = r.ok ? Object.fromEntries(r.quote.options.map((o) => [o.vehicleId, o.pricing.status])) : {};
    expect(byId).toMatchObject({ saloon: "price_on_request", estate: "price_on_request", mpv: "tariff", minibus: "tariff" });
  });

  it("doubles the fare at Christmas and says so", async () => {
    const r = await createQuote({ ...journey, date: "2026-12-25", time: "10:00" }, services(), { ...opts, now: new Date("2026-12-20T09:00:00Z") });
    const saloon = r.ok && r.quote.options.find((o) => o.vehicleId === "saloon");
    expect(saloon && saloon.pricing).toEqual({ status: "tariff", tariffVersion: "test-tariff-1", events: ["Christmas rate"] });
    const fare = saloon ? saloon.lines.find((l) => l.code === "journey")!.amount : 0;
    expect(saloon && saloon.lines.find((l) => l.code === "event_surcharge")?.amount).toBe(fare);
  });

  it("prices both legs of a return, using the way back's own distance", async () => {
    const r = await createQuote({ ...returnJourney, passengers: 2 }, services(), opts);
    expect(r.ok && r.quote.journey.returnJourney?.distanceMiles).toBeGreaterThan(0);
    const saloon = r.ok && r.quote.options.find((o) => o.vehicleId === "saloon");
    expect(saloon && saloon.lines.map((l) => l.code)).toEqual(["journey", "return_journey"]);
    expect(saloon && saloon.lines[1].label).toBe("Return journey fare");
  });

  it("books at the tariff price and records it", async () => {
    const svc = services();
    const q = await createQuote({ ...journey, passengers: 2 }, svc, opts);
    if (!q.ok) throw new Error("quote failed");
    const total = q.quote.options.find((o) => o.vehicleId === "saloon")!.total;
    const req: BookingRequest = {
      quoteToken: q.token,
      vehicleId: "saloon",
      addOns: { meetAndGreet: false, childSeats: 0 },
      customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
      pickupLine1: "1 Example Road",
      expectedTotal: total,
    };
    const r = await createBooking(req, svc, opts);
    expect(r.ok && r.booking).toMatchObject({ total, tariff: { version: "test-tariff-1", events: [] } });
    expect(r.ok && r.booking.referenceFare).toBeUndefined();

    // A tariff change between quote and booking is caught, never booked at a stale price.
    const changed = await createBooking(req, svc, { ...opts, tariff: { ...tariff, version: "test-tariff-2" } });
    expect(changed.ok || changed.errors.map((e) => e.code)).toEqual(["PRICE_CHANGED"]);
  });

  it("never prices large or unusual items, even with a tariff", async () => {
    const r = await createQuote({ ...journey, largeItems: true }, services(), opts);
    expect(r.ok && r.quote.options.every((o) => o.pricing.status === "price_on_request")).toBe(true);
  });
});

describe("activeTariff", () => {
  const placeholder = { isPlaceholder: true } as PricingConfig;
  const real = { isPlaceholder: false } as PricingConfig;

  it("never uses placeholder figures in production, even if asked", () => {
    expect(activeTariff({ NODE_ENV: "production", PLACEHOLDER_TARIFF: "on" }, placeholder)).toBeNull();
  });

  it("uses placeholder figures outside production only when switched on", () => {
    expect(activeTariff({ NODE_ENV: "development" }, placeholder)).toBeNull();
    expect(activeTariff({ NODE_ENV: "development", PLACEHOLDER_TARIFF: "on" }, placeholder)).toBe(placeholder);
  });

  it("uses real figures everywhere", () => {
    expect(activeTariff({ NODE_ENV: "production" }, real)).toBe(real);
  });

  it("ships switched on, with real figures", () => {
    expect(activeTariff({ NODE_ENV: "production" })).toMatchObject({ isPlaceholder: false, version: "galaxy-2026-10-19c" });
  });
});

describe("shipped service area", () => {
  it("covers the whole UK", async () => {
    const { serviceArea } = await vi.importActual<typeof import("@/config/service-area")>("@/config/service-area");
    const { isInServiceArea } = await import("@/lib/domain/geo");
    expect(serviceArea.wholeUk).toBe(true);
    expect(isInServiceArea(places["pc:OX1 1AA"], serviceArea)).toBe(true);
    expect(isInServiceArea(places["pc:SW1A 1AA"], serviceArea)).toBe(true);
  });
});

