import { describe, expect, it } from "vitest";
import { fleet } from "@/config/fleet";
import { capacityProblem } from "./capacity";
import {
  isValidFlightNumber,
  validateAirportStep,
  validateBookingDetails,
  validateJourneyStep,
  validatePartyStep,
  validateWhenStep,
} from "./validation";

const codes = (errors: { code: string }[]) => errors.map((e) => e.code);
// 10:00 London time (BST) on 5 Oct 2026.
const now = new Date("2026-10-05T09:00:00Z");

describe("journey step", () => {
  it("requires direction, airport and address", () => {
    expect(codes(validateJourneyStep({}))).toEqual(["DIRECTION_REQUIRED", "AIRPORT_REQUIRED", "ADDRESS_REQUIRED"]);
  });

  it("limits extra stops", () => {
    const stop = { locationId: "pc:SW1A 1AA" };
    const errors = validateJourneyStep({
      direction: "to_airport",
      airport: "LHR",
      address: stop,
      extraStops: [stop, stop, stop],
    });
    expect(codes(errors)).toContain("STOP_LIMIT");
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
  it("requires a terminal at multi-terminal airports", () => {
    expect(codes(validateAirportStep({ airport: "LHR", direction: "to_airport" }))).toEqual(["TERMINAL_REQUIRED"]);
  });

  it("does not ask for a terminal at single-terminal airports", () => {
    expect(validateAirportStep({ airport: "STN", direction: "to_airport" })).toEqual([]);
  });

  it("requires a flight number for pickups", () => {
    expect(codes(validateAirportStep({ airport: "LCY", direction: "from_airport" }))).toEqual([
      "FLIGHT_NUMBER_REQUIRED",
    ]);
  });

  it("rejects malformed flight numbers", () => {
    expect(codes(validateAirportStep({ airport: "LCY", direction: "to_airport", flightNumber: "HELLO" }))).toEqual([
      "FLIGHT_NUMBER_INVALID",
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
    addressLine1: "10 Example Street",
    needsPostcode: false,
    addOns: { meetAndGreet: false, childSeats: 0 },
  };

  it("accepts valid details", () => {
    expect(validateBookingDetails(valid)).toEqual([]);
  });

  it("flags missing contact details and address", () => {
    const errors = validateBookingDetails({
      ...valid,
      customer: { name: "", email: "nope", phone: "12" },
      addressLine1: "",
    });
    expect(codes(errors)).toEqual(["NAME_REQUIRED", "EMAIL_INVALID", "PHONE_INVALID", "ADDRESS_LINE_REQUIRED"]);
  });

  it("requires a postcode when a named area was chosen", () => {
    expect(codes(validateBookingDetails({ ...valid, needsPostcode: true }))).toEqual(["POSTCODE_REQUIRED"]);
  });
});
