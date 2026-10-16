import { describe, expect, it } from "vitest";
import { excludedReferenceVehicles, holidaySurchargeSource, vehicleMapping } from "@/config/reference-vehicles";
import type { VehicleId } from "@/lib/domain/types";
import { galaxyFareFromReference, inHolidayWindow, matchReferenceFare, type FareQuery } from "./match";
import type { ReferenceFare } from "./schema";

// Test fixtures only — a made-up address and amounts, not real reference fares.
const CHECKED = "2026-06-01T10:00:00+01:00";
const now = new Date("2026-06-03T12:00:00+01:00");

const oneWay: ReferenceFare = {
  id: "test-one-way",
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
  checkedAt: CHECKED,
  checkedBy: "Test",
  approvedBy: "Owner",
  approvedAt: CHECKED,
};

const returnFare: ReferenceFare = {
  ...oneWay,
  id: "test-return",
  tripType: "return",
  returnLeg: {
    status: "confirmed",
    pickup: { kind: "airport", airport: "LHR", terminal: "T5" },
    stops: [],
  },
  verifiedTravelDates: [{ outbound: "2026-06-10", return: "2026-06-17" }],
  referenceTotalPence: 20000,
};

const query: FareQuery = {
  vehicleId: "saloon",
  tripType: "one_way",
  pickup: { kind: "address", postcode: "SW1A 1AA", line1: "1 Test Street" },
  dropoff: { kind: "airport", airport: "LHR", terminal: "T5" },
  stops: [],
  date: "2026-06-10",
  time: "09:00",
  party: { passengers: 2, luggage: "suitcases" },
  extras: { meetAndGreet: false, childSeats: 0 },
};

const returnQuery: FareQuery = {
  ...query,
  tripType: "return",
  returnLeg: {
    pickup: { kind: "airport", airport: "LHR", terminal: "T5" },
    stops: [],
    date: "2026-06-17",
    time: "15:00",
  },
};

const reason = (r: ReturnType<typeof matchReferenceFare>) => (r.status === "price_on_request" ? r.reason : "matched");

describe("the £2 deduction", () => {
  it("charges £2 less than a one-way reference fare", () => {
    expect(galaxyFareFromReference(5000)).toBe(4800);
    expect(galaxyFareFromReference(10000)).toBe(9800);
    const r = matchReferenceFare(query, [oneWay], now);
    expect(r).toMatchObject({ status: "matched", referenceTotal: 5000, galaxyTotal: 4800 });
  });

  it("takes £2 off a return total once, not per leg", () => {
    const r = matchReferenceFare(returnQuery, [returnFare], now);
    expect(r).toMatchObject({ status: "matched", referenceTotal: 20000, galaxyTotal: 19800 });
  });

  it("refuses totals that would leave nothing to charge", () => {
    expect(() => galaxyFareFromReference(200)).toThrow(RangeError);
    expect(() => galaxyFareFromReference(150)).toThrow(RangeError);
    expect(() => galaxyFareFromReference(4800.5)).toThrow(RangeError);
  });
});

describe("exact route matching", () => {
  it("prices nothing when no fares are stored", () => {
    expect(reason(matchReferenceFare(query, [], now))).toBe("NO_MATCHING_FARE");
  });

  it.each([
    ["a different postcode", { pickup: { kind: "address", postcode: "SW1A 2AA", line1: "1 Test Street" } }],
    ["a different terminal", { dropoff: { kind: "airport", airport: "LHR", terminal: "T4" } }],
    ["a different airport", { dropoff: { kind: "airport", airport: "LGW", terminal: "N" } }],
    [
      "the opposite direction",
      { pickup: { kind: "airport", airport: "LHR", terminal: "T5" }, dropoff: { kind: "address", postcode: "SW1A 1AA", line1: "1 Test Street" } },
    ],
    ["an address instead of the airport", { dropoff: { kind: "address", postcode: "TW6 2GA" } }],
    ["an airport instead of the address", { pickup: { kind: "airport", airport: "LCY", terminal: null } }],
  ] as const)("does not match %s", (_label, change) => {
    expect(reason(matchReferenceFare({ ...query, ...change } as FareQuery, [oneWay], now))).toBe("NO_MATCHING_FARE");
  });

  it("accepts the same postcode written differently", () => {
    const r = matchReferenceFare({ ...query, pickup: { kind: "address", postcode: "sw1a1aa", line1: "1 Test Street" } }, [oneWay], now);
    expect(r.status).toBe("matched");
  });

  it("never prices a return from one-way fares", () => {
    expect(reason(matchReferenceFare(returnQuery, [oneWay], now))).toBe("NO_MATCHING_FARE");
  });

  it("never prices a one-way journey from a return fare", () => {
    expect(reason(matchReferenceFare(query, [returnFare], now))).toBe("NO_MATCHING_FARE");
  });
});

describe("return-route confirmation", () => {
  it("does not price a return whose route was not confirmed", () => {
    const unconfirmed: ReferenceFare = { ...returnFare, returnLeg: { status: "unconfirmed" } };
    expect(reason(matchReferenceFare(returnQuery, [unconfirmed], now))).toBe("RETURN_ROUTE_UNCONFIRMED");
  });

  it("does not price a return collected from somewhere else", () => {
    const q: FareQuery = { ...returnQuery, returnLeg: { ...returnQuery.returnLeg!, pickup: { kind: "address", postcode: "SW1A 2AA" } } };
    expect(reason(matchReferenceFare(q, [returnFare], now))).toBe("RETURN_ROUTE_MISMATCH");
  });

  it("does not price a return from a different terminal", () => {
    const q: FareQuery = {
      ...returnQuery,
      returnLeg: { ...returnQuery.returnLeg!, pickup: { kind: "airport", airport: "LHR", terminal: "T2" } },
    };
    expect(reason(matchReferenceFare(q, [returnFare], now))).toBe("RETURN_ROUTE_MISMATCH");
  });

  it("does not price a return with a stop the fare didn't include", () => {
    const q: FareQuery = { ...returnQuery, returnLeg: { ...returnQuery.returnLeg!, stops: ["E1 6AN"] } };
    expect(reason(matchReferenceFare(q, [returnFare], now))).toBe("RETURN_ROUTE_MISMATCH");
  });

  it("does not price a return collected from a different house on the same postcode", () => {
    const office = { postcode: "EC1A 1BB", line1: "5 Office Lane" };
    const a2a: ReferenceFare = {
      ...returnFare,
      id: "test-a2a-return",
      dropoff: { kind: "address", ...office },
      returnLeg: { status: "confirmed", pickup: { kind: "address", ...office }, stops: [] },
    };
    const back = { ...returnQuery.returnLeg!, pickup: { kind: "address" as const, ...office } };
    const q: FareQuery = { ...returnQuery, dropoff: { kind: "address", ...office }, returnLeg: back };
    expect(matchReferenceFare(q, [a2a], now)).toMatchObject({ status: "matched", galaxyTotal: 19800 });
    const other: FareQuery = { ...q, returnLeg: { ...back, pickup: { ...back.pickup, line1: "9 Office Lane" } } };
    expect(reason(matchReferenceFare(other, [a2a], now))).toBe("ADDRESS_MISMATCH");
  });
});

describe("return legs with different passengers, luggage or extras", () => {
  it("prices a return whose legs share the booking's passengers and extras", () => {
    const q: FareQuery = {
      ...returnQuery,
      returnLeg: { ...returnQuery.returnLeg!, party: returnQuery.party, extras: returnQuery.extras },
    };
    expect(matchReferenceFare(q, [returnFare], now).status).toBe("matched");
  });

  it("does not price a return leg with a different group", () => {
    const q: FareQuery = {
      ...returnQuery,
      returnLeg: { ...returnQuery.returnLeg!, party: { ...returnQuery.party, luggage: "hand_luggage" } },
    };
    expect(reason(matchReferenceFare(q, [returnFare], now))).toBe("RETURN_LEG_DIFFERS");
  });

  it("does not price a return leg with different extras", () => {
    const q: FareQuery = {
      ...returnQuery,
      returnLeg: { ...returnQuery.returnLeg!, extras: { meetAndGreet: true, childSeats: 0 } },
    };
    expect(reason(matchReferenceFare(q, [returnFare], now))).toBe("RETURN_LEG_DIFFERS");
  });

  it("does not price a return leg with more passengers", () => {
    const q: FareQuery = {
      ...returnQuery,
      returnLeg: { ...returnQuery.returnLeg!, party: { ...returnQuery.party, passengers: 3 } },
    };
    expect(reason(matchReferenceFare(q, [returnFare], now))).toBe("RETURN_LEG_DIFFERS");
  });
});

describe("verified travel dates", () => {
  it("does not price a date the reference price wasn't verified for", () => {
    expect(reason(matchReferenceFare({ ...query, date: "2026-06-11" }, [oneWay], now))).toBe("TRAVEL_DATE_UNVERIFIED");
  });

  it("never prices a fare with no verified dates", () => {
    expect(reason(matchReferenceFare(query, [{ ...oneWay, verifiedTravelDates: [] }], now))).toBe("TRAVEL_DATE_UNVERIFIED");
  });

  it("prices a return only for the verified outbound and return pair", () => {
    const otherReturnDay: FareQuery = { ...returnQuery, returnLeg: { ...returnQuery.returnLeg!, date: "2026-06-18" } };
    expect(reason(matchReferenceFare(otherReturnDay, [returnFare], now))).toBe("TRAVEL_DATE_UNVERIFIED");
    expect(reason(matchReferenceFare({ ...returnQuery, date: "2026-06-11" }, [returnFare], now))).toBe(
      "TRAVEL_DATE_UNVERIFIED",
    );
  });

  it("prices any listed verified date", () => {
    const fare: ReferenceFare = { ...oneWay, verifiedTravelDates: [{ outbound: "2026-06-10" }, { outbound: "2026-06-12" }] };
    expect(matchReferenceFare({ ...query, date: "2026-06-12" }, [fare], now).status).toBe("matched");
  });
});

describe("vehicle mapping", () => {
  it("keeps the Executive People Carrier out of pricing", () => {
    expect(excludedReferenceVehicles).toContain("executive_people_carrier");
    expect(Object.values(vehicleMapping)).not.toContain("executive_people_carrier");
  });

  it("never uses an Executive People Carrier fare for any Galaxy vehicle", () => {
    const epc: ReferenceFare = { ...oneWay, referenceVehicle: "executive_people_carrier" };
    for (const vehicleId of Object.keys(vehicleMapping) as VehicleId[]) {
      expect(matchReferenceFare({ ...query, vehicleId }, [epc], now).status).toBe("price_on_request");
    }
  });

  it("uses a fare only for the mapped Galaxy vehicle", () => {
    expect(matchReferenceFare({ ...query, vehicleId: "saloon" }, [oneWay], now).status).toBe("matched");
    expect(reason(matchReferenceFare({ ...query, vehicleId: "executive" }, [oneWay], now))).toBe("NO_MATCHING_FARE");
    const mpvFare: ReferenceFare = { ...oneWay, referenceVehicle: "people_carrier" };
    expect(matchReferenceFare({ ...query, vehicleId: "mpv" }, [mpvFare], now).status).toBe("matched");
  });
});

describe("stops, extras and luggage", () => {
  it("does not price a journey with a stop the fare didn't include", () => {
    expect(reason(matchReferenceFare({ ...query, stops: ["E1 6AN"] }, [oneWay], now))).toBe("STOPS_MISMATCH");
  });

  it("does not price different extras", () => {
    const withMeet = { ...query, extras: { meetAndGreet: true, childSeats: 0 } };
    const withSeat = { ...query, extras: { meetAndGreet: false, childSeats: 1 } };
    expect(reason(matchReferenceFare(withMeet, [oneWay], now))).toBe("EXTRAS_MISMATCH");
    expect(reason(matchReferenceFare(withSeat, [oneWay], now))).toBe("EXTRAS_MISMATCH");
  });

  it("prices only passenger and luggage combinations confirmed for the fare", () => {
    const extraBag = { ...query, party: { ...query.party, luggage: "hand_luggage" as const } };
    const fewerPeople = { ...query, party: { ...query.party, passengers: 1 } };
    expect(reason(matchReferenceFare(extraBag, [oneWay], now))).toBe("PARTY_UNCONFIRMED");
    expect(reason(matchReferenceFare(fewerPeople, [oneWay], now))).toBe("PARTY_UNCONFIRMED");
  });

  it("never matches a fare with no confirmed combinations", () => {
    const none: ReferenceFare = { ...oneWay, confirmedParties: [] };
    expect(reason(matchReferenceFare(query, [none], now))).toBe("PARTY_UNCONFIRMED");
  });

  it.each([
    ["none", "none"],
    ["hand luggage", "hand_luggage"],
    ["suitcases", "suitcases"],
  ] as const)("prices %s only when that exact category is confirmed", (_label, luggage) => {
    const fare: ReferenceFare = { ...oneWay, confirmedParties: [{ passengers: 2, luggage }] };
    const others = (["none", "hand_luggage", "suitcases"] as const).filter((c) => c !== luggage);
    expect(matchReferenceFare({ ...query, party: { passengers: 2, luggage } }, [fare], now).status).toBe("matched");
    for (const other of others) {
      expect(reason(matchReferenceFare({ ...query, party: { passengers: 2, luggage: other } }, [fare], now))).toBe("PARTY_UNCONFIRMED");
    }
  });

  it("never assumes a fare covers other passenger counts", () => {
    const fare: ReferenceFare = { ...oneWay, confirmedParties: [{ passengers: 2, luggage: "suitcases" }, { passengers: 4, luggage: "suitcases" }] };
    expect(matchReferenceFare({ ...query, party: { passengers: 4, luggage: "suitcases" } }, [fare], now).status).toBe("matched");
    expect(reason(matchReferenceFare({ ...query, party: { passengers: 3, luggage: "suitcases" } }, [fare], now))).toBe("PARTY_UNCONFIRMED");
  });
});

describe("approval", () => {
  it("never prices a pending fare", () => {
    expect(reason(matchReferenceFare(query, [{ ...oneWay, status: "pending" }], now))).toBe("NOT_APPROVED");
  });

  it("never prices an approved fare with no approver or approval time", () => {
    expect(reason(matchReferenceFare(query, [{ ...oneWay, approvedBy: " " }], now))).toBe("NOT_APPROVED");
    expect(reason(matchReferenceFare(query, [{ ...oneWay, approvedAt: null }], now))).toBe("NOT_APPROVED");
  });
});

describe("seven-day expiry", () => {
  const at = (iso: string) => new Date(iso);

  it("prices a fare checked 6 days 23 hours ago", () => {
    expect(matchReferenceFare(query, [oneWay], at("2026-06-08T09:00:00+01:00")).status).toBe("matched");
  });

  it("stops pricing exactly 7 days after the check", () => {
    expect(reason(matchReferenceFare(query, [oneWay], at("2026-06-08T10:00:00+01:00")))).toBe("EXPIRED");
    expect(reason(matchReferenceFare(query, [oneWay], at("2026-07-01T10:00:00+01:00")))).toBe("EXPIRED");
  });

  it("reports when the fare stops being valid", () => {
    const r = matchReferenceFare(query, [oneWay], now);
    expect(r.status === "matched" && r.validUntil).toBe("2026-06-08T09:00:00.000Z");
  });

  it("never prices a fare checked in the future", () => {
    const future: ReferenceFare = { ...oneWay, checkedAt: "2026-06-04T10:00:00+01:00", approvedAt: "2026-06-04T10:00:00+01:00" };
    expect(reason(matchReferenceFare(query, [future], now))).toBe("INVALID_ENTRY");
  });
});

describe("holiday surcharge dates", () => {
  it("records where the windows were read", () => {
    expect(holidaySurchargeSource).toMatchObject({ url: "https://www.airporttaxis-uk.co.uk/TAndC", checkedOn: "2026-10-12" });
  });

  it.each([
    ["2026-12-24", "18:00", true],
    ["2026-12-25", "12:00", true],
    ["2026-12-26", "23:59", true],
    ["2026-12-31", "22:00", true],
    ["2027-01-01", "08:00", true],
    ["2026-12-24", "17:59", false],
    ["2026-12-27", "00:00", false],
    ["2027-01-02", "00:00", false],
  ])("%s %s in window: %s", (date, time, expected) => {
    expect(inHolidayWindow(date, time)).toBe(expected);
  });

  it("does not price a journey with either leg in a surcharge window", () => {
    expect(reason(matchReferenceFare({ ...query, date: "2026-12-25", time: "10:00" }, [oneWay], now))).toBe("HOLIDAY_DATE");
    const q: FareQuery = { ...returnQuery, returnLeg: { ...returnQuery.returnLeg!, date: "2026-12-31", time: "20:00" } };
    expect(reason(matchReferenceFare(q, [returnFare], now))).toBe("HOLIDAY_DATE");
  });
});

describe("full address matching", () => {
  const flags = (q: FareQuery, fares = [oneWay]) => {
    const r = matchReferenceFare(q, fares, now);
    return r.status === "matched" ? r.flags : r.reason;
  };

  it("matches the same address written differently, without a flag", () => {
    expect(flags({ ...query, pickup: { kind: "address", postcode: "SW1A 1AA", line1: "1, test street" } })).toEqual([]);
  });

  it("does not price a different house number on the same postcode", () => {
    expect(flags({ ...query, pickup: { kind: "address", postcode: "SW1A 1AA", line1: "3 Test Street" } })).toBe("ADDRESS_MISMATCH");
  });

  it("prices on postcode alone when no house details are given, and flags it", () => {
    expect(flags({ ...query, pickup: { kind: "address", postcode: "SW1A 1AA" } })).toEqual(["ADDRESS_DETAIL_NOT_GIVEN"]);
    expect(flags({ ...query, pickup: { kind: "address", postcode: "SW1A 1AA", line1: "  " } })).toEqual(["ADDRESS_DETAIL_NOT_GIVEN"]);
  });

  it("picks the right house when two fares share a postcode, and refuses to guess without one", () => {
    const neighbour: ReferenceFare = {
      ...oneWay,
      id: "neighbour",
      pickup: { kind: "address", line1: "3 Test Street", postcode: "SW1A 1AA" },
      referenceTotalPence: 5500,
    };
    const r = matchReferenceFare({ ...query, pickup: { kind: "address", postcode: "SW1A 1AA", line1: "3 Test Street" } }, [oneWay, neighbour], now);
    expect(r).toMatchObject({ status: "matched", galaxyTotal: 5300 });
    expect(flags({ ...query, pickup: { kind: "address", postcode: "SW1A 1AA" } }, [oneWay, neighbour])).toBe("AMBIGUOUS");
  });
});

it("never prices a pending re-check alongside the approved fare", () => {
  const recheck: ReferenceFare = { ...oneWay, id: "recheck", status: "pending", approvedBy: "", approvedAt: null, referenceTotalPence: 5600 };
  expect(matchReferenceFare(query, [oneWay, recheck], now)).toMatchObject({ status: "matched", galaxyTotal: 4800 });
});

it("refuses to choose between two matching fares", () => {
  expect(reason(matchReferenceFare(query, [oneWay, { ...oneWay, id: "copy", referenceTotalPence: 5500 }], now))).toBe("AMBIGUOUS");
});
