import { describe, expect, it } from "vitest";
import shipped from "@/data/reference-fares.json";
import { loadReferenceFares } from ".";
import { checkFareData, type ReferenceFare } from "./schema";

// Test fixture only — a made-up address and amount, not a real reference fare.
const valid: ReferenceFare = {
  id: "test-fare",
  status: "approved",
  pickup: { kind: "address", line1: "1 Test Street", postcode: "SW1A 1AA" },
  dropoff: { kind: "airport", airport: "LHR", terminal: "T5" },
  tripType: "one_way",
  referenceVehicle: "saloon_car",
  confirmedParties: [{ passengers: 2, luggage: "suitcases" }],
  stops: [],
  extras: { meetAndGreet: false, childSeats: 0 },
  verifiedTravelDates: [{ outbound: "2026-06-10" }],
  currency: "GBP",
  vatIncluded: true,
  referenceTotalPence: 5000,
  checkedAt: "2026-06-01T10:00:00+01:00",
  checkedBy: "Test",
  approvedBy: "Owner",
  approvedAt: "2026-06-01T11:00:00+01:00",
};

const now = new Date("2026-06-03T12:00:00+01:00");
const messages = (data: unknown) => checkFareData(data, now).map((p) => p.message);

describe("shipped fare data", () => {
  it("is empty and valid", () => {
    expect(shipped).toEqual([]);
    expect(checkFareData(shipped)).toEqual([]);
    expect(loadReferenceFares()).toEqual([]);
  });
});

describe("checkFareData", () => {
  it("accepts a complete approved fare", () => {
    expect(messages([valid])).toEqual([]);
  });

  it("accepts a pending fare without an approver", () => {
    expect(messages([{ ...valid, status: "pending", approvedBy: "", approvedAt: null }])).toEqual([]);
  });

  it("requires an approver and approval time on approved fares", () => {
    expect(messages([{ ...valid, approvedBy: "" }])).toContain("Approved fares need approvedBy");
    expect(messages([{ ...valid, approvedAt: null }])).toContain("Approved fares need approvedAt");
    expect(messages([{ ...valid, approvedAt: "2026-06-01T09:00:00+01:00" }])).toContain("approvedAt is before checkedAt");
  });

  it("rejects totals of £2 or less", () => {
    expect(messages([{ ...valid, referenceTotalPence: 200 }])).toContain("Reference total must be more than £2");
  });

  it("rejects checks dated in the future", () => {
    const future = { ...valid, checkedAt: "2026-06-04T10:00:00+01:00", approvedAt: "2026-06-04T11:00:00+01:00" };
    expect(messages([future])).toContain("checkedAt is in the future");
  });

  it("rejects the excluded Executive People Carrier", () => {
    expect(messages([{ ...valid, referenceVehicle: "executive_people_carrier" }])).toContain(
      "executive_people_carrier is excluded from pricing",
    );
  });

  it("requires a return leg on return fares, and none on one-way fares", () => {
    const returnDates = [{ outbound: "2026-06-10", return: "2026-06-17" }];
    expect(messages([{ ...valid, tripType: "return", verifiedTravelDates: returnDates }])[0]).toMatch(/needs a returnLeg/);
    expect(messages([{ ...valid, returnLeg: { status: "unconfirmed" } }])).toContain("A one-way fare must not have a returnLeg");
    expect(
      messages([{ ...valid, tripType: "return", returnLeg: { status: "unconfirmed" }, verifiedTravelDates: returnDates }]),
    ).toEqual([]);
  });

  it("checks verified travel dates against the journey type", () => {
    const ret = { ...valid, tripType: "return", returnLeg: { status: "unconfirmed" } };
    expect(messages([ret])).toContain("Verified date 2026-06-10 needs a return date");
    expect(messages([{ ...valid, verifiedTravelDates: [{ outbound: "2026-06-10", return: "2026-06-17" }] }])).toContain(
      "Verified date 2026-06-10 must not have a return date on a one-way fare",
    );
    expect(messages([{ ...ret, verifiedTravelDates: [{ outbound: "2026-06-10", return: "2026-06-09" }] }])).toContain(
      "Verified return date 2026-06-09 is before 2026-06-10",
    );
    expect(messages([{ ...valid, verifiedTravelDates: [{ outbound: "2026-06-10" }, { outbound: "2026-06-10" }] }])).toContain(
      "Verified date 2026-06-10/ is listed twice",
    );
    expect(messages([{ ...valid, verifiedTravelDates: [{ outbound: "10/06/2026" }] }]).length).toBeGreaterThan(0);
  });

  it("accepts only the three luggage categories in confirmed combinations", () => {
    for (const luggage of ["none", "hand_luggage", "suitcases"]) {
      expect(messages([{ ...valid, confirmedParties: [{ passengers: 2, luggage }] }])).toEqual([]);
    }
    expect(messages([{ ...valid, confirmedParties: [{ passengers: 2, luggage: "bikes" }] }]).length).toBeGreaterThan(0);
    // Old-style luggage counts are no longer accepted.
    const oldStyle = { passengers: 2, standardSuitcases: 2, smallHandLuggage: 0, regularHandLuggage: 0 };
    expect(messages([{ ...valid, confirmedParties: [oldStyle] }]).length).toBeGreaterThan(0);
    expect(messages([{ ...valid, confirmedParties: [{ passengers: 2, luggage: "suitcases" }, { passengers: 2, luggage: "suitcases" }] }])).toContain(
      "Confirmed combination 2p suitcases is listed twice",
    );
  });

  it("rejects duplicate ids", () => {
    expect(messages([valid, { ...valid, referenceTotalPence: 6000 }])).toContain("Duplicate id");
  });

  it("rejects two fares with the same status for the same booking", () => {
    const sameBooking = 'Describes the same booking as "test-fare" with the same status (approved)';
    expect(messages([valid, { ...valid, id: "other" }])).toContain(sameBooking);
    // The same house written differently is still the same booking.
    const reworded = { ...valid, id: "other", pickup: { kind: "address", line1: "1, test street.", postcode: "SW1A 1AA" } };
    expect(messages([valid, reworded])).toContain(sameBooking);
    const pending = { ...valid, status: "pending", approvedBy: "", approvedAt: null };
    expect(messages([pending, { ...pending, id: "other" }])).toContain(
      'Describes the same booking as "test-fare" with the same status (pending)',
    );
  });

  it("allows one pending re-check beside the approved fare", () => {
    const recheck = { ...valid, id: "recheck", status: "pending", approvedBy: "", approvedAt: null, referenceTotalPence: 5600 };
    expect(messages([valid, recheck])).toEqual([]);
  });

  it("does not treat different routes or vehicles as duplicates", () => {
    const fares = [
      valid,
      { ...valid, id: "house", pickup: { kind: "address", line1: "3 Test Street", postcode: "SW1A 1AA" } },
      { ...valid, id: "terminal", dropoff: { kind: "airport", airport: "LHR", terminal: "T4" } },
      { ...valid, id: "direction", pickup: valid.dropoff, dropoff: valid.pickup },
      { ...valid, id: "a2a", dropoff: { kind: "address", line1: "5 Office Lane", postcode: "EC1A 1BB" } },
      { ...valid, id: "estate", referenceVehicle: "estate_car" },
      { ...valid, id: "stop", stops: ["E1 6AN"] },
    ];
    expect(messages(fares)).toEqual([]);
  });

  it("rejects other currencies, VAT-exclusive totals and malformed values", () => {
    expect(messages([{ ...valid, currency: "EUR" }]).length).toBeGreaterThan(0);
    expect(messages([{ ...valid, vatIncluded: false }]).length).toBeGreaterThan(0);
    expect(messages([{ ...valid, pickup: { kind: "address", line1: "1 Test Street", postcode: "sw1a1aa" } }]).length).toBeGreaterThan(0);
    expect(messages([{ ...valid, pickup: { kind: "station", line1: "Kings Cross", postcode: "N1 9AP" } }]).length).toBeGreaterThan(0);
    expect(messages([{ ...valid, pickup: { kind: "address", line1: "1 Test Street", postcode: "SW1A 1AA", airport: "LHR" } }]).length).toBeGreaterThan(0);
    expect(messages([{ ...valid, checkedAt: "2026-06-01 10:00" }]).length).toBeGreaterThan(0);
    expect(messages([{ ...valid, referenceTotalPence: 50.5 }]).length).toBeGreaterThan(0);
    expect(messages([{ ...valid, surprise: true }]).length).toBeGreaterThan(0);
    expect(messages({})).toEqual(["Fare data must be a list"]);
  });
});

describe("route rules for stored fares", () => {
  const office = { kind: "address", line1: "5 Office Lane", postcode: "EC1A 1BB" } as const;
  const confirmedReturn = (pickup: ReferenceFare["pickup"]) => ({
    ...valid,
    tripType: "return" as const,
    returnLeg: { status: "confirmed" as const, pickup, stops: [] },
    verifiedTravelDates: [{ outbound: "2026-06-10", return: "2026-06-17" }],
  });

  it("accepts the three journey kinds", () => {
    expect(messages([valid])).toEqual([]);
    expect(messages([{ ...valid, pickup: valid.dropoff, dropoff: valid.pickup }])).toEqual([]);
    expect(messages([{ ...valid, dropoff: office }])).toEqual([]);
  });

  it("refuses airport-to-airport fares and fares that start where they end", () => {
    expect(messages([{ ...valid, pickup: { kind: "airport", airport: "LGW", terminal: "N" } }])).toContain(
      "Airport-to-airport journeys can't be priced",
    );
    expect(messages([{ ...valid, dropoff: { ...office, postcode: "SW1A 1AA" } }])).toContain("Pickup and drop-off are the same place");
  });

  it("lets the way back start at another address or another terminal of the same airport, never another airport", () => {
    expect(messages([confirmedReturn({ kind: "airport", airport: "LHR", terminal: "T3" })])).toEqual([]);
    expect(messages([confirmedReturn(office)])).toEqual([]);
    const otherAirport = "A return can only be collected from an airport the outward journey went to";
    expect(messages([confirmedReturn({ kind: "airport", airport: "LGW", terminal: "N" })])).toContain(otherAirport);
    expect(messages([{ ...confirmedReturn({ kind: "airport", airport: "LHR", terminal: "T5" }), dropoff: office }])).toContain(otherAirport);
    expect(messages([confirmedReturn({ kind: "address", line1: "1 Test Street", postcode: "SW1A 1AA" })])).toContain(
      "The return pickup is the same place as the outward pickup",
    );
  });

  it("allows Meet & Greet only with an airport pickup on one of the legs", () => {
    const meet = { meetAndGreet: true, childSeats: 0 };
    const rule = "Meet & Greet needs an airport pickup on one of the legs";
    expect(messages([{ ...valid, extras: meet }])).toContain(rule);
    expect(messages([{ ...valid, dropoff: office, extras: meet }])).toContain(rule);
    expect(messages([{ ...valid, pickup: valid.dropoff, dropoff: valid.pickup, extras: meet }])).toEqual([]);
    expect(messages([{ ...confirmedReturn({ kind: "airport", airport: "LHR", terminal: "T3" }), extras: meet }])).toEqual([]);
    expect(messages([{ ...confirmedReturn(office), extras: meet }])).toContain(rule);
  });

  it("refuses the old airport-and-direction format", () => {
    const old = { ...valid, address: { line1: "1 Test Street", postcode: "SW1A 1AA" }, airport: { airport: "LHR", terminal: "T5" }, direction: "to_airport" };
    expect(messages([old]).length).toBeGreaterThan(0);
  });
});

describe("loadReferenceFares", () => {
  it("fails loudly on invalid data instead of pricing anything", () => {
    expect(() => loadReferenceFares([{ ...valid, approvedBy: "" }], now)).toThrow(/approvedBy/);
  });

  it("returns valid fares", () => {
    expect(loadReferenceFares([valid], now)).toEqual([valid]);
  });
});
