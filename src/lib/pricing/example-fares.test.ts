import { describe, expect, it } from "vitest";
import { pricing } from "@/config/pricing";
import { airportCodes } from "@/lib/domain/airports";
import { centralLondonFrom, exampleFares } from "./example-fares";

describe("example fares", () => {
  it("lists every area and vehicle for each airport from the live tariff", () => {
    for (const code of airportCodes) {
      const rows = exampleFares(code, pricing);
      expect(rows).toHaveLength(6);
      for (const r of rows) expect(Object.keys(r.prices)).toEqual(["saloon", "estate", "executive", "mpv", "minibus"]);
    }
  });

  it("uses the cheapest terminal, as a 'from' price", () => {
    // Central London to Heathrow: Terminal 5 is £71, Terminals 2–4 £8 less.
    expect(centralLondonFrom("LHR", pricing)).toBe(6300);
  });

  it("shows nothing without a tariff", () => {
    expect(exampleFares("LHR", null)).toEqual([]);
    expect(centralLondonFrom("LHR", null)).toBeNull();
  });
});
