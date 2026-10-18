import { describe, expect, it } from "vitest";
import type { PricingConfig } from "@/config/pricing";
import type { ReferenceFare } from "@/lib/reference-fares/schema";
import { formatTariffCheck } from "../../../scripts/tariff-check.mjs";
import { checkTariffAgainstFares } from "./tariff-check";

// Test figures only: not Galaxy's rates or real reference fares.
const flat = { baseFare: 4000, includedMiles: 10, perMile: 200, minimumFare: 4500, dropOffCharge: 0, pickupParking: 0 };
const tariff: PricingConfig = {
  version: "test",
  isPlaceholder: false,
  roundTo: 100,
  airports: { LHR: flat, LGW: flat, STN: flat, LTN: flat, LCY: flat },
  vehicleMultipliers: { saloon: 1, estate: 1.2, executive: 1.5, mpv: 1.4, minibus: 1.8 },
  extras: { meetAndGreet: 1500, childSeat: 800, extraStop: 1000 },
  timeSurcharges: [],
  eventSurcharges: [],
};

const fare = (over: Partial<ReferenceFare>): ReferenceFare => ({
  id: "TEST",
  status: "approved",
  pickup: { kind: "address", line1: "1 Test Street", postcode: "SW1A 1AA" },
  dropoff: { kind: "airport", airport: "LHR", terminal: "T5" },
  tripType: "one_way",
  referenceVehicle: "saloon_car",
  confirmedParties: [{ passengers: 2, luggage: "suitcases" }],
  stops: [],
  extras: { meetAndGreet: false, childSeats: 0 },
  verifiedTravelDates: [{ outbound: "2026-10-20" }],
  currency: "GBP",
  vatIncluded: true,
  referenceTotalPence: 6000,
  checkedAt: "2026-10-18T10:00:00+01:00",
  checkedBy: "Test",
  approvedBy: "Owner",
  approvedAt: "2026-10-18T11:00:00+01:00",
  notes: "",
  ...over,
});

const lookup = async (pc: string) => (pc === "SW1A 1AA" ? { lat: 51.501, lng: -0.1416 } : null);
// A fixed 20 miles each way keeps the sums obvious: £40 + 10 × £2 = £60 for a saloon.
const twentyMiles = { routeMiles: async () => 20 };

describe("checkTariffAgainstFares", () => {
  it("passes a tariff at least £2 under the reference total", async () => {
    const [row] = await checkTariffAgainstFares([fare({ referenceTotalPence: 6200 })], tariff, lookup, twentyMiles);
    expect(row).toMatchObject({ vehicleId: "saloon", ceiling: 6000, tariffTotal: 6000, verdict: "ok" });
  });

  it("flags a tariff above reference minus £2", async () => {
    const [row] = await checkTariffAgainstFares([fare({ referenceTotalPence: 6100 })], tariff, lookup, twentyMiles);
    expect(row).toMatchObject({ ceiling: 5900, tariffTotal: 6000, verdict: "too_high" });
  });

  it("uses the Galaxy vehicle mapped to the reference vehicle", async () => {
    const [row] = await checkTariffAgainstFares([fare({ referenceVehicle: "people_carrier", referenceTotalPence: 9000 })], tariff, lookup, twentyMiles);
    expect(row).toMatchObject({ vehicleId: "mpv", tariffTotal: 8400 });
  });

  it("skips fares it can't place, saying why", async () => {
    const [row] = await checkTariffAgainstFares(
      [fare({ pickup: { kind: "address", line1: "1 Nowhere", postcode: "ZZ1 1ZZ" } })],
      tariff,
      lookup,
      twentyMiles,
    );
    expect(row).toMatchObject({ verdict: "not_checked", note: "Postcode not found: ZZ1 1ZZ" });
  });
});

describe("formatTariffCheck", () => {
  it("says when there is nothing to compare, without claiming a pass", () => {
    const text = formatTariffCheck([], { version: "v1", isPlaceholder: true });
    expect(text).toContain("No reference fares stored yet");
    expect(text).toContain("PLACEHOLDER");
    expect(text).not.toContain("at least £2 under");
  });

  it("lists over-priced fares and how much to lower them", () => {
    const text = formatTariffCheck(
      [{ id: "A", status: "approved", vehicleId: "saloon", referenceTotal: 6100, ceiling: 5900, tariffTotal: 6000, verdict: "too_high" }],
      { version: "v1", isPlaceholder: false },
    );
    expect(text).toContain("TOO HIGH A [approved] saloon: reference £61.00, most allowed £59.00, tariff £60.00 (£1.00 over)");
    expect(text).toContain("1 fare(s) where the tariff is more than reference minus £2");
  });
});
