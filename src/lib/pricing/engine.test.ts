import { describe, expect, it } from "vitest";
import type { PricingConfig } from "@/config/pricing";
import { journeyFare, price, surchargeApplies } from "./engine";

const tariff = { baseFare: 4000, includedMiles: 10, perMile: 200, minimumFare: 4500, dropOffCharge: 700, pickupParking: 800 };
const config: PricingConfig = {
  version: "test",
  isPlaceholder: true,
  roundTo: 100,
  airports: { LHR: tariff, LGW: tariff, STN: tariff, LTN: tariff, LCY: { ...tariff, dropOffCharge: 0 } },
  vehicleMultipliers: { saloon: 1, estate: 1.15, executive: 1.5, mpv: 1.35, minibus: 1.8 },
  extras: { meetAndGreet: 1500, childSeat: 800, extraStop: 1000 },
  timeSurcharges: [{ label: "Night", from: "23:00", to: "05:00", percent: 10, enabled: true }],
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
