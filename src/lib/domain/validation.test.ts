import { describe, expect, it } from "vitest";
import { fleet } from "@/config/fleet";
import { capacityProblem } from "./capacity";
import {
  isValidFlightNumber,
  validateAirportStep,
  validateBookingDetails,
  validateJourneyStep,
  validatePartyStep,
  validateReturnJourney,
  validateWhenStep,
} from "./validation";
import type { JourneyEndInput } from "./types";

const address = (locationId: string): JourneyEndInput => ({ kind: "address", locationId });
const airport = (code: "LHR" | "LGW" | "STN" | "LCY", terminal?: string): JourneyEndInput => ({ kind: "airport", airport: code, terminal });

const codes = (errors: { code: string }[]) => errors.map((e) => e.code);
// 10:00 London time (BST) on 5 Oct 2026.
const now = new Date("2026-10-05T09:00:00Z");

describe("journey step", () => {
  it("requires a pickup and a drop-off", () => {
    expect(codes(validateJourneyStep({}))).toEqual(["ADDRESS_REQUIRED", "ADDRESS_REQUIRED"]);
    expect(codes(validateJourneyStep({ pickup: address(""), dropoff: { kind: "airport" } as JourneyEndInput }))).toEqual([
      "ADDRESS_REQUIRED",
      "AIRPORT_REQUIRED",
    ]);
  });

  it.each([
    ["address to airport", address("pc:SW1A 1AA"), airport("LHR")],
    ["airport to address", airport("LGW"), address("pc:SW1A 1AA")],
    ["address to address", address("pc:SW1A 1AA"), address("pc:EC1A 1BB")],
  ])("accepts %s", (_label, pickup, dropoff) => {
    expect(validateJourneyStep({ pickup, dropoff })).toEqual([]);
  });

  it("refuses airport to airport, even at the same airport", () => {
    expect(codes(validateJourneyStep({ pickup: airport("LHR"), dropoff: airport("LGW") }))).toEqual(["ROUTE_UNSUPPORTED"]);
    expect(codes(validateJourneyStep({ pickup: airport("LHR", "T2"), dropoff: airport("LHR", "T5") }))).toEqual(["ROUTE_UNSUPPORTED"]);
  });

  it("refuses the same address at both ends", () => {
    expect(codes(validateJourneyStep({ pickup: address("pc:SW1A 1AA"), dropoff: address("pc:SW1A 1AA") }))).toEqual(["SAME_LOCATION"]);
  });

  it("limits stops to two per leg, and refuses repeated stops or stops at either end", () => {
    const route = { pickup: address("pc:SW1A 1AA"), dropoff: airport("LHR") };
    const stop = (locationId: string) => ({ locationId });
    expect(validateJourneyStep({ ...route, extraStops: [stop("pc:E1 6AN"), stop("pc:W1A 1AA")] })).toEqual([]);
    expect(codes(validateJourneyStep({ ...route, extraStops: [stop("pc:E1 6AN"), stop("pc:W1A 1AA"), stop("pc:N1 9GU")] }))).toEqual([
      "STOP_LIMIT",
    ]);
    expect(codes(validateJourneyStep({ ...route, extraStops: [stop("pc:E1 6AN"), stop("pc:E1 6AN")] }))).toEqual(["STOP_DUPLICATE"]);
    expect(codes(validateJourneyStep({ ...route, extraStops: [stop("pc:SW1A 1AA")] }))).toEqual(["STOP_SAME_LOCATION"]);
  });
});

describe("when step", () => {
  it.each([
    [{}, ["DATE_REQUIRED", "TIME_REQUIRED"]],
    [{ date: "2026-02-30", time: "10:00" }, ["DATE_INVALID"]],
    [{ date: "2026-10-04", time: "10:00" }, ["DATE_IN_PAST"]],
    [{ date: "2028-01-01", time: "10:00" }, ["DATE_TOO_FAR"]],
    [{ date: "2026-10-06", time: "25:00" }, ["TIME_INVALID"]],
    [{ date: "2026-10-05", time: "12:30" }, ["TIME_TOO_SOON"]],
    [{ date: "2026-10-05", time: "13:00" }, []],
  ])("%j → %j", (input, expected) => {
    expect(codes(validateWhenStep(input, now))).toEqual(expected);
  });
});

describe("party step", () => {
  it("requires a passenger count", () => {
    expect(codes(validatePartyStep({ passengers: null, luggage: { large: 0, small: 0 } }))).toEqual([
      "PASSENGERS_REQUIRED",
    ]);
  });

  it("rejects groups no vehicle can carry", () => {
    expect(codes(validatePartyStep({ passengers: 9, luggage: { large: 0, small: 0 } }))).toEqual([
      "CAPACITY_EXCEEDED",
    ]);
  });

  it("accepts a group that fits", () => {
    expect(validatePartyStep({ passengers: 2, luggage: { large: 2, small: 1 } })).toEqual([]);
  });
});

describe("airport step", () => {
  const home = address("pc:SW1A 1AA");

  it("requires a terminal at multi-terminal airports, at whichever end the airport is", () => {
    expect(validateAirportStep({ pickup: home, dropoff: airport("LHR") }).map((e) => e.field)).toEqual(["dropoff.terminal"]);
    expect(validateAirportStep({ pickup: airport("LGW", "X"), dropoff: home, flightNumber: "BA1" }).map((e) => `${e.field}:${e.code}`)).toEqual([
      "pickup.terminal:TERMINAL_INVALID",
    ]);
  });

  it("does not ask for a terminal at single-terminal airports", () => {
    expect(validateAirportStep({ pickup: home, dropoff: airport("STN") })).toEqual([]);
  });

  it("requires a flight number for airport pickups only", () => {
    expect(codes(validateAirportStep({ pickup: airport("LCY"), dropoff: home }))).toEqual(["FLIGHT_NUMBER_REQUIRED"]);
    expect(validateAirportStep({ pickup: home, dropoff: address("pc:EC1A 1BB") })).toEqual([]);
  });

  it("rejects malformed flight numbers", () => {
    expect(codes(validateAirportStep({ pickup: home, dropoff: airport("LCY"), flightNumber: "HELLO" }))).toEqual([
      "FLIGHT_NUMBER_INVALID",
    ]);
  });
});

describe("return journey", () => {
  const home = address("pc:SW1A 1AA");
  const back = { extraStops: [], date: "2026-10-12", time: "10:00" };
  const outward = { date: "2026-10-06", time: "10:00" };
  const check = (input: Parameters<typeof validateReturnJourney>[0]) =>
    validateReturnJourney({ ...outward, ...input }, now).map((e) => `${e.field}:${e.code}`);

  it("starts from another terminal of the airport the outward journey went to", () => {
    expect(check({ pickup: home, dropoff: airport("LHR", "T5"), returnJourney: { ...back, pickup: airport("LHR", "T3"), flightNumber: "BA1" } })).toEqual([]);
  });

  it("never starts from a different airport, or from an airport after a journey to an address", () => {
    const outwardToLhr = { pickup: home, dropoff: airport("LHR", "T5") };
    expect(check({ ...outwardToLhr, returnJourney: { ...back, pickup: airport("LGW", "N"), flightNumber: "BA1" } })).toEqual([
      "returnJourney.pickup:RETURN_PICKUP_INVALID",
    ]);
    expect(check({ pickup: home, dropoff: address("pc:EC1A 1BB"), returnJourney: { ...back, pickup: airport("LHR", "T5"), flightNumber: "BA1" } })).toEqual([
      "returnJourney.pickup:RETURN_PICKUP_INVALID",
    ]);
  });

  it("can start from another address, but not from the outward pickup it goes back to", () => {
    const a2a = { pickup: home, dropoff: address("pc:EC1A 1BB") };
    expect(check({ ...a2a, returnJourney: { ...back, pickup: address("pc:E1 6AN") } })).toEqual([]);
    expect(check({ ...a2a, returnJourney: { ...back, pickup: home } })).toEqual(["returnJourney.pickup:SAME_LOCATION"]);
  });

  it("has its own two stops", () => {
    const a2a = { pickup: home, dropoff: address("pc:EC1A 1BB") };
    const stops = ["pc:E1 6AN", "pc:W1A 1AA", "pc:N1 9GU"].map((locationId) => ({ locationId }));
    expect(check({ ...a2a, returnJourney: { ...back, pickup: address("pc:EC1A 1BB"), extraStops: stops.slice(0, 2) } })).toEqual([]);
    expect(check({ ...a2a, returnJourney: { ...back, pickup: address("pc:EC1A 1BB"), extraStops: stops } })).toEqual([
      "returnJourney.extraStops:STOP_LIMIT",
    ]);
  });
});

describe("flight numbers", () => {
  it.each(["BA2490", "ba 2490", "EZY8012", "U2 8012", "FR123", "BA249A"])("accepts %s", (f) => {
    expect(isValidFlightNumber(f)).toBe(true);
  });
  it.each(["", "12345", "B2490X1", "ABCD123"])("rejects %s", (f) => {
    expect(isValidFlightNumber(f)).toBe(false);
  });
});

describe("capacity", () => {
  const saloon = fleet.find((v) => v.id === "saloon")!;
  it("lets small cases use spare large-case space", () => {
    expect(capacityProblem(saloon, 2, { large: 1, small: 3 })).toBeNull();
  });
  it("rejects too many passengers", () => {
    expect(capacityProblem(saloon, 5, { large: 0, small: 0 })).toMatch(/passengers/);
  });
});

describe("booking details", () => {
  const valid = {
    customer: { name: "Sam Taylor", email: "sam@example.com", phone: "+44 7700 900123" },
    addressLines: [{ field: "pickupLine1", value: "10 Example Street" }],
    addOns: { meetAndGreet: false, childSeats: 0 },
  };

  it("accepts valid details", () => {
    expect(validateBookingDetails(valid)).toEqual([]);
  });

  it("flags missing contact details and address", () => {
    const errors = validateBookingDetails({
      ...valid,
      customer: { name: "", email: "nope", phone: "12" },
      addressLines: [{ field: "pickupLine1", value: "" }],
    });
    expect(codes(errors)).toEqual(["NAME_REQUIRED", "EMAIL_INVALID", "PHONE_INVALID", "ADDRESS_LINE_REQUIRED"]);
  });

  it("checks the house number and street of every address end, under its own field", () => {
    const errors = validateBookingDetails({
      ...valid,
      addressLines: [
        { field: "pickupLine1", value: "1 Example Road" },
        { field: "dropoffLine1", value: "" },
        { field: "returnPickupLine1", value: "x".repeat(121) },
      ],
    });
    expect(errors.map((e) => `${e.field}:${e.code}`)).toEqual(["dropoffLine1:ADDRESS_LINE_REQUIRED", "returnPickupLine1:TEXT_TOO_LONG"]);
    expect(validateBookingDetails({ ...valid, addressLines: [] })).toEqual([]);
  });
});
