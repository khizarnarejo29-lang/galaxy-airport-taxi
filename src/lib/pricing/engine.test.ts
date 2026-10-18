import { describe, expect, it } from "vitest";
import type { PricingConfig } from "@/config/pricing";
import { activeEvent, eventApplies, journeyFare, price, surchargeApplies } from "./engine";

const tariff = { baseFare: 4000, includedMiles: 10, perMile: 200, minimumFare: 4500, dropOffCharge: 700, pickupParking: 800 };
const config: PricingConfig = {
  version: "test",
  isPlaceholder: true,
  roundTo: 100,
  airports: { LHR: tariff, LGW: tariff, STN: tariff, LTN: tariff, LCY: { ...tariff, dropOffCharge: 0 } },
  vehicleMultipliers: { saloon: 1, estate: 1.15, executive: 1.5, mpv: 1.35, minibus: 1.8 },
  extras: { meetAndGreet: 1500, childSeat: 800, extraStop: 1000 },
  timeSurcharges: [{ label: "Night", from: "23:00", to: "05:00", percent: 10, enabled: true }],
  eventSurcharges: [
    { label: "Christmas rate", from: { date: "12-24", time: "18:00" }, to: { date: "12-26", time: "23:59" }, multiplier: 2, enabled: true },
    { label: "New Year rate", from: { date: "12-31", time: "18:00" }, to: { date: "01-01", time: "23:59" }, multiplier: 2, enabled: true },
  ],
};

const base = {
  direction: "to_airport" as const,
  airport: "LHR" as const,
  vehicleId: "saloon" as const,
  distanceMiles: 15,
  time: "12:00",
  extraStops: 0,
};

describe("journeyFare", () => {
  it("charges base fare plus per-mile beyond included miles", () => {
    expect(journeyFare(base, config)).toBe(4000 + 5 * 200);
  });

  it("applies the minimum fare for short journeys", () => {
    expect(journeyFare({ ...base, distanceMiles: 2 }, config)).toBe(4500);
  });

  it("applies the vehicle multiplier and rounds to whole pounds", () => {
    // 5000 × 1.15 = 5750 → £58
    expect(journeyFare({ ...base, vehicleId: "estate" }, config)).toBe(5800);
  });
});

describe("price", () => {
  it("adds the drop-off charge for journeys to the airport", () => {
    const r = price(base, config);
    expect(r.lines.map((l) => l.code)).toEqual(["journey", "airport_charge"]);
    expect(r.total).toBe(5000 + 700);
  });

  it("adds parking, Meet & Greet and child seats for pickups", () => {
    const r = price(
      { ...base, direction: "from_airport", addOns: { meetAndGreet: true, childSeats: 2 } },
      config,
    );
    expect(r.total).toBe(5000 + 800 + 1500 + 1600);
  });

  it("ignores Meet & Greet on drop-offs", () => {
    const r = price({ ...base, addOns: { meetAndGreet: true, childSeats: 0 } }, config);
    expect(r.lines.some((l) => l.code === "meet_and_greet")).toBe(false);
  });

  it("charges for extra stops", () => {
    expect(price({ ...base, extraStops: 2 }, config).total).toBe(5000 + 2000 + 700);
  });

  it("omits zero airport charges", () => {
    const r = price({ ...base, airport: "LCY" }, config);
    expect(r.lines.some((l) => l.code === "airport_charge")).toBe(false);
  });

  it("applies an enabled time surcharge", () => {
    const r = price({ ...base, time: "23:30" }, config);
    expect(r.lines.find((l) => l.code === "time_surcharge")?.amount).toBe(500);
  });
});

describe("surchargeApplies", () => {
  const night = config.timeSurcharges[0];
  it.each([
    ["23:00", true],
    ["02:15", true],
    ["04:59", true],
    ["05:00", false],
    ["14:00", false],
  ])("%s → %s", (time, expected) => {
    expect(surchargeApplies(night, time)).toBe(expected);
  });

  it("never applies when disabled", () => {
    expect(surchargeApplies({ ...night, enabled: false }, "01:00")).toBe(false);
  });
});

describe("event surcharges", () => {
  const christmas = config.eventSurcharges[0];
  const newYear = config.eventSurcharges[1];

  it.each([
    ["2026-12-24", "17:59", false],
    ["2026-12-24", "18:00", true],
    ["2026-12-25", "12:00", true],
    ["2026-12-26", "23:59", true],
    ["2026-12-27", "00:00", false],
  ])("Christmas on %s at %s: %s", (date, time, expected) => {
    expect(eventApplies(christmas, date, time)).toBe(expected);
  });

  it("handles a window that crosses the new year", () => {
    expect(eventApplies(newYear, "2026-12-31", "20:00")).toBe(true);
    expect(eventApplies(newYear, "2027-01-01", "09:00")).toBe(true);
    expect(eventApplies(newYear, "2027-01-02", "09:00")).toBe(false);
  });

  it("doubles the journey fare only, leaving extras and airport charges alone", () => {
    const r = price({ ...base, date: "2026-12-25", direction: "from_airport", addOns: { meetAndGreet: true, childSeats: 1 } }, config);
    expect(r.lines.find((l) => l.code === "event_surcharge")).toEqual({ code: "event_surcharge", label: "Christmas rate", amount: 5000 });
    expect(r.total).toBe(5000 * 2 + 800 + 1500 + 800);
  });

  it("adds nothing on an ordinary day or without a date", () => {
    expect(price({ ...base, date: "2026-10-12" }, config).lines.some((l) => l.code === "event_surcharge")).toBe(false);
    expect(activeEvent(config, undefined, "12:00")).toBeUndefined();
  });

  it("ignores disabled events and uses the highest multiplier where events overlap", () => {
    const overlapping = {
      ...config,
      eventSurcharges: [
        { ...christmas, multiplier: 1.5 },
        { ...christmas, label: "Big event", multiplier: 3 },
        { ...christmas, label: "Off", multiplier: 5, enabled: false },
      ],
    };
    expect(activeEvent(overlapping, "2026-12-25", "12:00")?.label).toBe("Big event");
  });
});
