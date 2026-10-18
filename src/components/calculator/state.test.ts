import { describe, expect, it } from "vitest";
import { fieldError } from "@/lib/domain/errors";
import type { ResolvedLocation } from "@/lib/domain/types";
import {
  chosenLuggage,
  emptyDraft,
  meetAndGreetAvailable,
  reducer,
  selectedOption,
  stepForErrors,
  stepsFor,
  toJourneyInput,
  toggleLuggage,
  validateStep,
  type CalcState,
  type Draft,
} from "./state";

describe("stepForErrors", () => {
  it.each([
    ["pickup", "journey"],
    ["dropoff", "journey"],
    ["extraStops", "journey"],
    ["extraStops.1", "journey"],
    ["tripType", "journey"],
    ["returnJourney", "journey"],
    ["returnJourney.pickup", "journey"],
    ["returnJourney.extraStops.0", "journey"],
    ["time", "when"],
    ["returnJourney.date", "when"],
    ["returnJourney.time", "when"],
    ["passengers", "party"],
    ["luggageCategory", "party"],
    ["largeItems", "party"],
    ["pickup.terminal", "airport"],
    ["dropoff.terminal", "airport"],
    ["flightNumber", "airport"],
    ["returnJourney.pickup.terminal", "airport"],
    ["returnJourney.flightNumber", "airport"],
    ["addOns", "extras"],
    ["addOns.childSeats", "extras"],
    ["vehicleId", "vehicle"],
    ["pickupLine1", "details"],
    ["dropoffLine1", "details"],
    ["returnPickupLine1", "details"],
    ["customer.email", "details"],
  ])("%s → %s", (field, step) => {
    expect(stepForErrors([fieldError(field, "BAD_REQUEST")])).toBe(step);
  });

  it("picks the earliest step", () => {
    expect(stepForErrors([fieldError("customer.name", "NAME_REQUIRED"), fieldError("date", "DATE_INVALID")])).toBe("when");
  });

  it("ignores errors that belong to no step", () => {
    expect(stepForErrors([fieldError("quote", "QUOTE_INVALID")])).toBeUndefined();
    expect(stepForErrors([fieldError("total", "PRICE_CHANGED")])).toBeUndefined();
  });
});

describe("reducer", () => {
  const base: CalcState = { step: "vehicle", draft: emptyDraft, errors: [], quote: null, busy: null, notice: null, hydrated: true };
  const quote = { quote: { options: [] }, token: "t" } as unknown as CalcState["quote"];

  it.each<Partial<Draft>>([
    { passengers: 3 },
    { tripType: "return" },
    { returnDate: "2026-11-01" },
    { luggageCategory: "suitcases" },
    { largeItems: true },
    { addOns: { meetAndGreet: true, childSeats: 0 } },
  ])("drops the quote when a priced field changes: %o", (patch) => {
    expect(reducer({ ...base, quote }, { type: "set", patch }).quote).toBeNull();
  });

  it("keeps the quote for unpriced fields", () => {
    const next = reducer({ ...base, quote }, { type: "set", patch: { notes: "hi" } });
    expect(next.quote).toBe(quote);
  });

  it("clears only the edited field's errors", () => {
    const errors = [fieldError("customer.email", "EMAIL_INVALID"), fieldError("pickupLine1", "ADDRESS_LINE_REQUIRED")];
    const next = reducer({ ...base, errors }, { type: "set", patch: { customer: emptyDraft.customer } });
    expect(next.errors.map((e) => e.field)).toEqual(["pickupLine1"]);
  });

  it("clears route errors on both ends when either end changes, but not house-number errors", () => {
    const errors = [
      fieldError("dropoff", "SAME_LOCATION"),
      fieldError("extraStops.0", "STOP_SAME_LOCATION"),
      fieldError("dropoffLine1", "ADDRESS_LINE_REQUIRED"),
    ];
    const next = reducer({ ...base, errors }, { type: "set", patch: { pickupAddress: null } });
    expect(next.errors.map((e) => e.field)).toEqual(["dropoffLine1"]);
  });

  it("clears return-journey errors when a return field is edited", () => {
    const errors = [fieldError("returnJourney.time", "TIME_REQUIRED"), fieldError("time", "TIME_REQUIRED")];
    const next = reducer({ ...base, errors }, { type: "set", patch: { returnTime: "10:00" } });
    expect(next.errors.map((e) => e.field)).toEqual(["time"]);
  });

  it.each<Partial<Draft>>([{ dropoffAirport: "LGW" }, { dropoffKind: "address" }, { pickupKind: "airport" }])(
    "resets both terminals when the airport changes: %o",
    (patch) => {
      const draft = { ...emptyDraft, dropoffAirport: "LHR" as const, terminal: "T5", returnTerminal: "T3" };
      const next = reducer({ ...base, draft }, { type: "set", patch });
      expect([next.draft.terminal, next.draft.returnTerminal]).toEqual(["", ""]);
    },
  );

  it("keeps the terminals when the same airport is chosen again", () => {
    const draft = { ...emptyDraft, dropoffAirport: "LHR" as const, terminal: "T5" };
    expect(reducer({ ...base, draft }, { type: "set", patch: { dropoffAirport: "LHR" } }).draft.terminal).toBe("T5");
  });

  it("restores a saved session only once", () => {
    const saved = { step: "review" as const, draft: emptyDraft, quote: null };
    const first = reducer({ ...base, step: "journey", hydrated: false }, { type: "restore", state: saved });
    expect(first.step).toBe("review");
    expect(reducer(first, { type: "restore", state: { ...saved, step: "journey" } }).step).toBe("review");
  });
});

const home: ResolvedLocation = { id: "pc:SW1A 1AA", kind: "postcode", label: "SW1A 1AA", postcode: "SW1A 1AA", lat: 51.5, lng: -0.14 };
const office: ResolvedLocation = { id: "pc:EC1A 1BB", kind: "postcode", label: "EC1A 1BB", postcode: "EC1A 1BB", lat: 51.52, lng: -0.1 };
const draft: Draft = {
  ...emptyDraft,
  pickupAddress: home,
  dropoffAirport: "LHR",
  date: "2027-03-10",
  time: "09:00",
  passengers: 2,
  terminal: "T5",
  largeItems: false,
};

describe("toJourneyInput", () => {
  it("sends a one-way trip with its luggage category and no return", () => {
    const input = toJourneyInput({ ...draft, luggageCategory: "hand_luggage" });
    expect(input).toMatchObject({ tripType: "one_way", luggageCategory: "hand_luggage" });
    expect(toJourneyInput(draft).luggageCategory).toBeUndefined();
    expect(input.returnJourney).toBeUndefined();
    expect(input.luggage).toBeUndefined();
  });

  it("sends each end as an address or an airport", () => {
    expect([toJourneyInput(draft).pickup, toJourneyInput(draft).dropoff]).toEqual([
      { kind: "address", locationId: "pc:SW1A 1AA", line1: undefined },
      { kind: "airport", airport: "LHR", terminal: "T5" },
    ]);
    const fromAirport: Draft = { ...draft, pickupKind: "airport", pickupAirport: "LGW", terminal: "N", dropoffKind: "address", dropoffAddress: office };
    expect([toJourneyInput(fromAirport).pickup, toJourneyInput(fromAirport).dropoff]).toEqual([
      { kind: "airport", airport: "LGW", terminal: "N" },
      { kind: "address", locationId: "pc:EC1A 1BB", line1: undefined },
    ]);
    const a2a: Draft = { ...draft, dropoffKind: "address", dropoffAddress: office, flightNumber: "BA123" };
    expect(toJourneyInput(a2a)).toMatchObject({ dropoff: { kind: "address", locationId: "pc:EC1A 1BB" }, flightNumber: undefined });
  });

  it("starts the way back at the outward drop-off unless another address is chosen", () => {
    const ret: Draft = { ...draft, tripType: "return", returnDate: "2027-03-17", returnTime: "18:00", returnTerminal: "T3" };
    expect(toJourneyInput(ret).returnJourney).toMatchObject({
      pickup: { kind: "airport", airport: "LHR", terminal: "T3" },
      date: "2027-03-17",
      time: "18:00",
    });
    const a2a: Draft = { ...ret, dropoffKind: "address", dropoffAddress: office, dropoffLine1: "5 Office Lane" };
    expect(toJourneyInput(a2a).returnJourney?.pickup).toEqual({ kind: "address", locationId: "pc:EC1A 1BB", line1: "5 Office Lane" });
    const elsewhere: Draft = { ...ret, returnFromDifferentAddress: true, returnPickupAddress: office, returnPickupLine1: " 5 Office Lane " };
    expect(toJourneyInput(elsewhere).returnJourney?.pickup).toEqual({ kind: "address", locationId: "pc:EC1A 1BB", line1: "5 Office Lane" });
  });

  it("sends stops for each leg", () => {
    const ret: Draft = { ...draft, tripType: "return", extraStops: [office], returnExtraStops: [office, null] };
    expect(toJourneyInput(ret).extraStops).toEqual([{ locationId: "pc:EC1A 1BB" }]);
    expect(toJourneyInput(ret).returnJourney?.extraStops).toEqual([{ locationId: "pc:EC1A 1BB" }, { locationId: "" }]);
  });

  it("includes house details once given", () => {
    const ret: Draft = { ...draft, tripType: "return", pickupLine1: " 1 Example Road " };
    expect(toJourneyInput(ret).pickup).toEqual({ kind: "address", locationId: "pc:SW1A 1AA", line1: "1 Example Road" });
  });

  it("only asks for Meet & Greet where a leg starts at an airport", () => {
    const withMeet = { ...draft, addOns: { meetAndGreet: true, childSeats: 0 } };
    const meet = (d: Draft) => [meetAndGreetAvailable(d), toJourneyInput(d).extras?.meetAndGreet];
    expect(meet(withMeet)).toEqual([false, false]);
    expect(meet({ ...withMeet, pickupKind: "airport", pickupAirport: "LHR", dropoffKind: "address", dropoffAddress: office })).toEqual([true, true]);
    expect(meet({ ...withMeet, tripType: "return" })).toEqual([true, true]);
    expect(meet({ ...withMeet, tripType: "return", returnFromDifferentAddress: true, returnPickupAddress: office })).toEqual([false, false]);
    expect(meet({ ...withMeet, tripType: "return", dropoffKind: "address", dropoffAddress: office })).toEqual([false, false]);
  });

  it("skips the airport step when no end is an airport", () => {
    expect(stepsFor(draft).map((s) => s.id)).toContain("airport");
    expect(stepsFor({ ...draft, dropoffKind: "address" }).map((s) => s.id)).not.toContain("airport");
    expect(stepsFor({ ...draft, dropoffKind: "address" })).toHaveLength(7);
  });
});

describe("validateStep", () => {
  const ret: Draft = { ...draft, tripType: "return", returnDate: "2027-03-17", returnTime: "18:00" };
  const fields = (errors: { field: string }[]) => errors.map((e) => e.field);

  it("needs a return pickup address when collecting somewhere else", () => {
    expect(fields(validateStep("journey", { ...ret, returnFromDifferentAddress: true }, null))).toEqual(["returnJourney.pickup"]);
    expect(validateStep("journey", { ...ret, returnFromDifferentAddress: true, returnPickupAddress: office }, null)).toEqual([]);
  });

  it("checks both ends and the stops on the journey step", () => {
    const codes = (d: Draft) => validateStep("journey", d, null).map((e) => `${e.field}:${e.code}`);
    expect(codes({ ...draft, pickupAddress: null, dropoffAirport: null })).toEqual(["pickup:ADDRESS_REQUIRED", "dropoff:AIRPORT_REQUIRED"]);
    expect(codes({ ...draft, pickupKind: "airport", pickupAirport: "LGW" })).toEqual(["dropoff:ROUTE_UNSUPPORTED"]);
    expect(codes({ ...draft, dropoffKind: "address", dropoffAddress: home })).toEqual(["dropoff:SAME_LOCATION"]);
    expect(codes({ ...draft, extraStops: [office, office, null] })).toEqual([
      "extraStops:STOP_LIMIT",
      "extraStops.1:STOP_DUPLICATE",
      "extraStops.2:ADDRESS_REQUIRED",
    ]);
    expect(codes({ ...draft, extraStops: [home] })).toEqual(["extraStops.0:STOP_SAME_LOCATION"]);
    expect(codes({ ...ret, returnExtraStops: [home] })).toEqual(["returnJourney.extraStops.0:STOP_SAME_LOCATION"]);
  });

  it("checks the return date and time on the when step", () => {
    expect(fields(validateStep("when", { ...ret, returnDate: "", returnTime: "" }, null))).toEqual([
      "returnJourney.date",
      "returnJourney.time",
    ]);
    expect(validateStep("when", { ...ret, returnDate: "2027-03-10", returnTime: "08:00" }, null).map((e) => e.code)).toEqual([
      "RETURN_BEFORE_OUTBOUND",
    ]);
  });

  it("needs the return terminal and flight for an airport pickup on the way back", () => {
    expect(fields(validateStep("airport", ret, null))).toEqual(["returnJourney.pickup.terminal", "returnJourney.flightNumber"]);
    expect(validateStep("airport", { ...ret, returnTerminal: "T3", returnFlightNumber: "BA123" }, null)).toEqual([]);
    // Collected from an address on the way back: no return terminal or flight to ask for.
    expect(validateStep("airport", { ...ret, returnFromDifferentAddress: true, returnPickupAddress: office }, null)).toEqual([]);
  });

  it("needs the outward terminal, and a flight number when collecting from the airport", () => {
    expect(fields(validateStep("airport", { ...draft, terminal: "" }, null))).toEqual(["dropoff.terminal"]);
    const fromAirport: Draft = { ...draft, pickupKind: "airport", pickupAirport: "LHR", dropoffKind: "address", dropoffAddress: office };
    expect(fields(validateStep("airport", fromAirport, null))).toEqual(["flightNumber"]);
  });

  it("requires an answer about large items", () => {
    const errors = validateStep("party", { ...draft, luggageCategory: "suitcases", largeItems: null }, null);
    expect(errors.map((e) => [e.field, e.code, e.message])).toEqual([
      ["largeItems", "LARGE_ITEMS_REQUIRED", "Tell us whether you're bringing any large or unusual items."],
    ]);
    expect(validateStep("party", { ...draft, luggageCategory: "suitcases", largeItems: true }, null)).toEqual([]);
    expect(toJourneyInput({ ...draft, largeItems: true }).largeItems).toBe(true);
    expect(toJourneyInput({ ...draft, largeItems: null }).largeItems).toBeUndefined();
  });

  it("requires a luggage category", () => {
    const errors = validateStep("party", { ...draft, luggageCategory: null }, null);
    expect(errors.map((e) => [e.field, e.code])).toEqual([["luggageCategory", "LUGGAGE_CATEGORY_REQUIRED"]]);
    expect(errors[0].message).toBe("Choose your luggage: none, hand luggage or suitcases.");
    for (const luggageCategory of ["none", "hand_luggage", "suitcases"] as const) {
      expect(validateStep("party", { ...draft, luggageCategory }, null)).toEqual([]);
    }
  });

  it("asks for passengers but not fleet luggage limits", () => {
    expect(fields(validateStep("party", { ...draft, passengers: null, luggageCategory: "suitcases" }, null))).toEqual(["passengers"]);
    const lots = { ...draft, passengers: 8, luggageCategory: "suitcases" as const };
    expect(validateStep("party", lots, null)).toEqual([]);
  });

  it("needs a house number and street for every address end", () => {
    const customer = { name: "Sam", email: "sam@example.com", phone: "07700 900123" };
    const details: Draft = { ...ret, returnFromDifferentAddress: true, returnPickupAddress: office, customer, pickupLine1: "1 Example Road" };
    expect(fields(validateStep("details", details, null))).toEqual(["returnPickupLine1"]);
    expect(validateStep("details", { ...details, returnPickupLine1: "5 Office Lane" }, null)).toEqual([]);
    const a2a: Draft = { ...draft, dropoffKind: "address", dropoffAddress: office, customer };
    expect(fields(validateStep("details", a2a, null))).toEqual(["pickupLine1", "dropoffLine1"]);
    // No address end: nothing to ask for.
    const airportOnly: Draft = { ...draft, customer };
    expect(fields(validateStep("details", { ...airportOnly, pickupLine1: "1 Example Road" }, null))).toEqual([]);
  });

  it("only lets a priced vehicle be chosen", () => {
    const quote = {
      token: "t",
      quote: {
        options: [
          { vehicleId: "saloon", available: true, total: 4800, lines: [], pricing: { status: "priced" } },
          { vehicleId: "mpv", available: false, total: 0, lines: [], pricing: { status: "price_on_request", reason: "NO_MATCHING_FARE" } },
        ],
      },
    } as unknown as CalcState["quote"];
    expect(validateStep("vehicle", { ...draft, vehicleId: "saloon" }, quote)).toEqual([]);
    expect(validateStep("vehicle", { ...draft, vehicleId: "mpv" }, quote).map((e) => e.code)).toEqual(["VEHICLE_UNAVAILABLE"]);
    expect(selectedOption({ ...draft, vehicleId: "saloon" }, quote)?.total).toBe(4800);
  });
});

describe("luggage choice", () => {
  const start = { luggageCategory: null, handLuggageToo: false } as const;
  const tap = (...items: Parameters<typeof toggleLuggage>[1][]) =>
    items.reduce<Pick<Draft, "luggageCategory" | "handLuggageToo">>((d, item) => toggleLuggage(d, item), start);

  it("lets hand luggage and suitcases be chosen together, priced as suitcases", () => {
    expect(tap("hand_luggage", "suitcases")).toEqual({ luggageCategory: "suitcases", handLuggageToo: true });
    expect(tap("suitcases", "hand_luggage")).toEqual({ luggageCategory: "suitcases", handLuggageToo: true });
    expect(chosenLuggage(tap("hand_luggage", "suitcases"))).toEqual({ none: false, hand_luggage: true, suitcases: true });
  });

  it("chooses one item on its own", () => {
    expect(tap("hand_luggage")).toEqual({ luggageCategory: "hand_luggage", handLuggageToo: false });
    expect(tap("suitcases")).toEqual({ luggageCategory: "suitcases", handLuggageToo: false });
    expect(tap("none")).toEqual({ luggageCategory: "none", handLuggageToo: false });
  });

  it("unticks items independently, and back to no answer when nothing is left", () => {
    expect(tap("hand_luggage", "suitcases", "suitcases")).toEqual({ luggageCategory: "hand_luggage", handLuggageToo: false });
    expect(tap("hand_luggage", "suitcases", "hand_luggage")).toEqual({ luggageCategory: "suitcases", handLuggageToo: false });
    expect(tap("suitcases", "suitcases")).toEqual({ luggageCategory: null, handLuggageToo: false });
  });

  it("treats None as its own answer: it clears the others, and picking one clears None", () => {
    expect(tap("hand_luggage", "suitcases", "none")).toEqual({ luggageCategory: "none", handLuggageToo: false });
    expect(tap("none", "suitcases")).toEqual({ luggageCategory: "suitcases", handLuggageToo: false });
    expect(chosenLuggage(tap("none"))).toEqual({ none: true, hand_luggage: false, suitcases: false });
  });

  it("sends the hand luggage to the server only with suitcases", () => {
    const both = { ...emptyDraft, ...tap("hand_luggage", "suitcases") };
    expect(toJourneyInput(both)).toMatchObject({ luggageCategory: "suitcases", handLuggageToo: true });
    const handOnly = { ...emptyDraft, ...tap("hand_luggage") };
    expect(toJourneyInput(handOnly).handLuggageToo).toBeUndefined();
  });
});
