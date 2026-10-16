import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildReport, formatReport } from "../../../scripts/fares-report.mjs";
import type { ReferenceFare } from "./schema";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const HOUR = 60 * 60 * 1000;

// Test fixtures only — a made-up address and amount, not a real reference fare.
const CHECKED = "2026-06-01T10:00:00+01:00";
const checked = Date.parse(CHECKED);
const fare: ReferenceFare = {
  id: "TEST-ONE",
  status: "approved",
  pickup: { kind: "address", line1: "1 Test Street", postcode: "SW1A 1AA" },
  dropoff: { kind: "airport", airport: "LHR", terminal: "T5" },
  tripType: "one_way",
  referenceVehicle: "saloon_car",
  confirmedParties: [{ passengers: 2, luggage: "suitcases" }],
  stops: [],
  extras: { meetAndGreet: false, childSeats: 0 },
  verifiedTravelDates: [{ outbound: "2026-06-20" }],
  currency: "GBP",
  vatIncluded: true,
  referenceTotalPence: 5000,
  checkedAt: CHECKED,
  checkedBy: "Test checker",
  approvedBy: "Test owner",
  approvedAt: CHECKED,
};

const at = (hoursAfterCheck: number) => new Date(checked + hoursAfterCheck * HOUR);
const ids = (items: { fare: ReferenceFare }[]) => items.map((i) => i.fare.id);

describe("buildReport", () => {
  it("reports an empty fare file clearly", async () => {
    const report = await buildReport([], { now: at(1) });
    expect(report.total).toBe(0);
    expect(formatReport(report)).toContain("No reference fares are stored. Every journey currently shows “Price on request”.");
  });

  it("treats a fare as expired at exactly 168 hours", async () => {
    const report = await buildReport([fare], { now: at(168) });
    expect(ids(report.expired)).toEqual(["TEST-ONE"]);
    expect(ids(report.usable)).toEqual([]);
  });

  it("treats a fare one second short of 168 hours as expiring, not expired", async () => {
    const report = await buildReport([fare], { now: new Date(checked + 168 * HOUR - 1000) });
    expect(ids(report.expired)).toEqual([]);
    expect(ids(report.expiringSoon)).toEqual(["TEST-ONE"]);
  });

  it("flags fares with 24 hours or less left as expiring", async () => {
    expect(ids((await buildReport([fare], { now: at(144) })).expiringSoon)).toEqual(["TEST-ONE"]); // exactly 24 h left
    const earlier = await buildReport([fare], { now: new Date(checked + 144 * HOUR - 60_000) }); // 24 h 1 min left
    expect(ids(earlier.expiringSoon)).toEqual([]);
    expect(ids(earlier.usable)).toEqual(["TEST-ONE"]);
  });

  it("lists pending fares separately and never as in use", async () => {
    const pending: ReferenceFare = { ...fare, id: "TEST-PENDING", status: "pending", approvedBy: "", approvedAt: null };
    const report = await buildReport([pending], { now: at(2) });
    expect(ids(report.pending)).toEqual(["TEST-PENDING"]);
    expect(ids(report.usable)).toEqual([]);
  });

  it("flags approved fares whose verified travel dates have all passed", async () => {
    const past: ReferenceFare = { ...fare, id: "TEST-PAST", verifiedTravelDates: [{ outbound: "2026-06-01" }, { outbound: "2026-06-02" }] };
    const none: ReferenceFare = { ...fare, id: "TEST-NONE", pickup: { kind: "address", postcode: "SW1A 1AA", line1: "2 Test Street" }, verifiedTravelDates: [] };
    const report = await buildReport([past, none], { now: at(48) }); // 3 June
    expect(ids(report.datesPassed)).toEqual(["TEST-PAST", "TEST-NONE"]);
    const text = formatReport(report);
    expect(text).toContain("Last verified date 2026-06-02");
    expect(text).toContain("No verified travel dates listed");
  });

  it("formats every section with counts", async () => {
    const text = formatReport(await buildReport([fare], { now: at(2) }));
    expect(text).toContain("1 fare(s) stored. Each fare is valid for exactly 168 hours from its check time.");
    expect(text).toContain("EXPIRED — no longer priced; re-check or remove (0)");
    expect(text).toContain("EXPIRING WITHIN 24 HOURS — re-check soon (0)");
    expect(text).toContain("IN USE — approved, in date and with upcoming verified dates (1)");
    expect(text).toContain("next date 2026-06-20");
  });

  it("reports an invalid fare file instead of sorting it", async () => {
    const report = await buildReport([{ ...fare, approvedBy: "" }], { now: at(2) });
    expect(report.problems.length).toBeGreaterThan(0);
    const text = formatReport(report);
    expect(text).toContain("THE FARE FILE IS INVALID");
    expect(text).toContain("Approved fares need approvedBy");
  });
});

describe("fares:report command (plain Node, as the owner runs it)", () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("VITEST"))) as NodeJS.ProcessEnv;
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/fares-report.mjs", ...args], {
      cwd: ROOT,
      env,
      encoding: "utf8",
    });

  it("reports the website's real fare file, which is empty", () => {
    const r = cli();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("No reference fares are stored.");
  });

  it("reports a given file at a given time, and fails on invalid data", () => {
    const dir = mkdtempSync(join(tmpdir(), "gat-report-"));
    const good = join(dir, "fares.json");
    writeFileSync(good, JSON.stringify([fare]));
    const expiring = cli("--file", good, "--now", at(150).toISOString());
    expect(expiring.status).toBe(0);
    expect(expiring.stdout).toContain("EXPIRING WITHIN 24 HOURS — re-check soon (1)");

    const bad = join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify([{ ...fare, currency: "EUR" }]));
    const invalid = cli("--file", bad);
    expect(invalid.status).toBe(1);
    expect(invalid.stdout).toContain("THE FARE FILE IS INVALID");
  });
});
