import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLUMNS, importFares, parseCsv } from "../../../scripts/fares-import.mjs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const now = new Date("2026-06-03T12:00:00+01:00");

// Test fixtures only — a made-up address and amount, not a real reference fare.
const base: Record<string, string> = {
  id: "TEST-SW1A1AA-LHR-T5-ONEWAY-SALOON",
  status: "approved",
  source_url: "https://www.airporttaxis-uk.co.uk/",
  pickup_line1: "1 Test Street",
  pickup_postcode: "SW1A 1AA",
  pickup_airport: "",
  pickup_terminal: "",
  dropoff_line1: "",
  dropoff_postcode: "",
  dropoff_airport: "LHR",
  dropoff_terminal: "T5",
  trip_type: "one_way",
  return_route: "",
  return_pickup_line1: "",
  return_pickup_postcode: "",
  return_pickup_airport: "",
  return_pickup_terminal: "",
  return_stops: "",
  reference_vehicle: "Saloon Car",
  galaxy_vehicle: "saloon",
  confirmed_parties: "2p suitcases; 3p Hand Luggage",
  stops: "",
  meet_and_greet: "no",
  child_seats: "0",
  verified_travel_dates: "2026-06-10; 2026-06-11",
  reference_total_gbp: "50.00",
  currency: "GBP",
  vat_included: "yes",
  checked_at: "2026-06-01T10:00:00+01:00",
  checked_by: "Test checker",
  approved_by: "Test owner",
  approved_at: "2026-06-01T11:00:00+01:00",
  expires_at: "",
  notes: "",
};

const returnRow = {
  ...base,
  id: "TEST-SW1A1AA-LHR-T5-RETURN-SALOON",
  trip_type: "return",
  return_route: "confirmed",
  return_pickup_airport: "LHR",
  return_pickup_terminal: "T3",
  verified_travel_dates: "2026-06-10>2026-06-17",
  reference_total_gbp: "100",
};

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
const csv = (...rows: Record<string, string>[]) =>
  [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => quote(r[c] ?? "")).join(","))].join("\r\n") + "\r\n";

const run = (...rows: Record<string, string>[]) => importFares(csv(...rows), { now });
const messages = async (...rows: Record<string, string>[]) => {
  const r = await run(...rows);
  return r.ok ? [] : r.problems.map((p: { message: string }) => p.message);
};

describe("parseCsv", () => {
  it("keeps commas, quotes and line breaks inside quoted fields", () => {
    const text = '﻿a,b,c\r\n"12-14, Greatorex Street","say ""hi""","line\none"\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["12-14, Greatorex Street", 'say "hi"', "line\none"],
    ]);
  });

  it("handles unquoted fields, empty cells and a missing final newline", () => {
    expect(parseCsv("a,,c\nx,y,")).toEqual([
      ["a", "", "c"],
      ["x", "y", ""],
    ]);
  });

  it("rejects broken quoting", () => {
    expect(() => parseCsv('a,"open\n')).toThrow(/never closed/);
    expect(() => parseCsv('a,b"c"\n')).toThrow(/Unexpected quote/);
  });
});

describe("the template", () => {
  it("has exactly the importer's columns and no fares", () => {
    const rows = parseCsv(readFileSync(join(ROOT, "docs/reference-fares-template.csv"), "utf8"));
    expect(rows).toEqual([COLUMNS]);
  });
});

describe("importFares", () => {
  it("converts a valid one-way row into the website's fare format", async () => {
    const r = await run(base);
    expect(r.ok).toBe(true);
    expect(r.ok && r.fares).toEqual([
      {
        id: "TEST-SW1A1AA-LHR-T5-ONEWAY-SALOON",
        status: "approved",
        pickup: { kind: "address", line1: "1 Test Street", postcode: "SW1A 1AA" },
        dropoff: { kind: "airport", airport: "LHR", terminal: "T5" },
        tripType: "one_way",
        referenceVehicle: "saloon_car",
        confirmedParties: [
          { passengers: 2, luggage: "suitcases" },
          { passengers: 3, luggage: "hand_luggage" },
        ],
        stops: [],
        extras: { meetAndGreet: false, childSeats: 0 },
        verifiedTravelDates: [{ outbound: "2026-06-10" }, { outbound: "2026-06-11" }],
        currency: "GBP",
        vatIncluded: true,
        referenceTotalPence: 5000,
        checkedAt: "2026-06-01T10:00:00+01:00",
        checkedBy: "Test checker",
        approvedBy: "Test owner",
        approvedAt: "2026-06-01T11:00:00+01:00",
        notes: "Source: https://www.airporttaxis-uk.co.uk/",
      },
    ]);
  });

  it("converts a return with a confirmed return route from another terminal, and date pairs", async () => {
    const r = await run(returnRow);
    expect(r.ok && r.fares[0]).toMatchObject({
      tripType: "return",
      returnLeg: { status: "confirmed", pickup: { kind: "airport", airport: "LHR", terminal: "T3" }, stops: [] },
      verifiedTravelDates: [{ outbound: "2026-06-10", return: "2026-06-17" }],
      referenceTotalPence: 10000,
    });
  });

  it("converts an address-to-address return collected from another address containing a comma", async () => {
    const r = await run({
      ...returnRow,
      dropoff_airport: "",
      dropoff_terminal: "",
      dropoff_line1: "5 Office Lane",
      dropoff_postcode: "EC1A 1BB",
      return_pickup_airport: "",
      return_pickup_terminal: "",
      return_pickup_line1: "12-14, Greatorex Street",
      return_pickup_postcode: "E1 5NF",
      return_stops: "E2 7DG",
    });
    expect(r.ok && r.fares[0]).toMatchObject({
      pickup: { kind: "address", line1: "1 Test Street", postcode: "SW1A 1AA" },
      dropoff: { kind: "address", line1: "5 Office Lane", postcode: "EC1A 1BB" },
      returnLeg: { status: "confirmed", pickup: { kind: "address", line1: "12-14, Greatorex Street", postcode: "E1 5NF" }, stops: ["E2 7DG"] },
    });
  });

  it("converts a journey from the airport", async () => {
    const r = await run({
      ...base,
      pickup_line1: "",
      pickup_postcode: "",
      pickup_airport: "lgw",
      pickup_terminal: "s",
      dropoff_line1: "1 Test Street",
      dropoff_postcode: "SW1A 1AA",
      dropoff_airport: "",
      dropoff_terminal: "",
      meet_and_greet: "yes",
    });
    expect(r.ok && [r.fares[0].pickup, r.fares[0].dropoff, r.fares[0].extras.meetAndGreet]).toEqual([
      { kind: "airport", airport: "LGW", terminal: "S" },
      { kind: "address", line1: "1 Test Street", postcode: "SW1A 1AA" },
      true,
    ]);
  });

  it("leaves the terminal empty for single-terminal airports", async () => {
    const r = await run({ ...base, dropoff_airport: "STN", dropoff_terminal: "" });
    expect(r.ok && r.fares[0].dropoff).toEqual({ kind: "airport", airport: "STN", terminal: null });
  });

  it("accepts pending fares without approval details, and keeps owner notes after the source", async () => {
    const r = await run({ ...base, status: "pending", approved_by: "", approved_at: "", notes: "Re-check, price looked high" });
    expect(r.ok && r.fares[0]).toMatchObject({
      status: "pending",
      approvedBy: "",
      approvedAt: null,
      notes: "Source: https://www.airporttaxis-uk.co.uk/ | Re-check, price looked high",
    });
  });

  it("never trusts a typed expiry: it's ignored and a warning shows the real one", async () => {
    const r = await run({ ...base, expires_at: "2027-01-01T00:00:00Z" });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w: { message: string }) => w.message)).toEqual([
      "expires_at ignored: the fare expires at 2026-06-08T09:00:00.000Z (check time + 168 hours)",
    ]);
    expect(r.ok && JSON.stringify(r.fares)).not.toContain("2027-01-01");
    // A correct value is accepted silently.
    expect((await run({ ...base, expires_at: "2026-06-08T10:00:00+01:00" })).warnings).toEqual([]);
  });

  it.each<[string, Record<string, string>, RegExp]>([
    ["a future check time", { checked_at: "2099-01-01T10:00:00Z", approved_at: "2099-01-01T11:00:00Z" }, /checkedAt is in the future/],
    ["an approved fare with no approver", { approved_by: "" }, /need approvedBy/],
    ["an approved fare with no approval time", { approved_at: "" }, /need approvedAt/],
    ["approval before the check", { approved_at: "2026-06-01T09:00:00+01:00" }, /approvedAt is before checkedAt/],
    ["an unknown status", { status: "maybe" }, /status/],
    ["the excluded Executive People Carrier", { reference_vehicle: "Executive People Carrier", galaxy_vehicle: "" }, /excluded from pricing/],
    ["a vehicle the reference doesn't list", { reference_vehicle: "Limousine" }, /reference_vehicle: use one of/],
    ["a wrong Galaxy vehicle mapping", { galaxy_vehicle: "estate" }, /maps to Galaxy "saloon", not "estate"/],
    ["an unknown airport", { dropoff_airport: "XYZ" }, /dropoff_airport: use one of/],
    ["an invalid terminal", { dropoff_terminal: "T9" }, /needs one of T2, T3, T4, T5/],
    ["a terminal at a single-terminal airport", { dropoff_airport: "STN", dropoff_terminal: "T1" }, /leave blank: Stansted Airport has a single terminal/],
    ["an end that is both an airport and an address", { dropoff_postcode: "EC1A 1BB" }, /dropoff_airport: fill in either an airport or an address, not both/],
    ["an end that is neither", { pickup_line1: "", pickup_postcode: "" }, /pickup_line1: fill in an address/],
    ["a terminal on an address", { pickup_terminal: "T5" }, /pickup_terminal: leave blank unless this end is an airport/],
    ["an airport-to-airport journey", { pickup_line1: "", pickup_postcode: "", pickup_airport: "LCY" }, /Airport-to-airport journeys can't be priced/],
    ["a journey that starts where it ends", { dropoff_airport: "", dropoff_terminal: "", dropoff_line1: "2 Test Street", dropoff_postcode: "SW1A 1AA" }, /same place/],
    ["Meet & Greet without an airport pickup", { meet_and_greet: "yes" }, /Meet & Greet needs an airport pickup/],
    ["return details on a one-way fare", { return_pickup_postcode: "SW1A 1AA" }, /leave blank on a one-way fare/],
    ["a source that isn't the reference website", { source_url: "https://example.com/fare" }, /source_url/],
    ["a total of £2", { reference_total_gbp: "2.00" }, /must be more than £2/],
    ["a badly written price", { reference_total_gbp: "1,084.00" }, /reference_total_gbp/],
    ["a badly written passenger/luggage combination", { confirmed_parties: "two people" }, /should look like/],
    ["an unknown luggage category", { confirmed_parties: "2p bikes" }, /should look like "2p suitcases"/],
    ["old-style luggage counts", { confirmed_parties: "2p 2std 0small 0reg" }, /should look like "2p suitcases"/],
    ["the same combination twice", { confirmed_parties: "2p suitcases; 2p  SUITCASES" }, /Confirmed combination 2p suitcases is listed twice/],
    ["an invalid postcode", { pickup_postcode: "SW1A1AA" }, /full UK postcode/],
    ["an invalid travel date", { verified_travel_dates: "10/06/2026" }, /YYYY-MM-DD/],
    ["a return date on a one-way fare", { verified_travel_dates: "2026-06-10>2026-06-17" }, /must not have a return date/],
    ["a timestamp without a time zone", { checked_at: "2026-06-01 10:00" }, /time zone/],
    ["a currency other than GBP", { currency: "EUR" }, /currency/],
    ["prices without VAT", { vat_included: "no" }, /vatIncluded/],
    ["a missing yes/no", { meet_and_greet: "" }, /meet_and_greet: use "yes" or "no"/],
  ])("rejects %s", async (_label, change, expected) => {
    expect((await messages({ ...base, ...change })).join("\n")).toMatch(expected);
  });

  it.each<[string, Record<string, string>, RegExp]>([
    ["no return route status", { return_route: "" }, /return_route: use "confirmed" or "unconfirmed"/],
    ["an unconfirmed route with return details filled in", { return_route: "unconfirmed" }, /leave blank when the return route is unconfirmed/],
    ["a confirmed route without a return pickup", { return_pickup_airport: "", return_pickup_terminal: "" }, /return_pickup_line1: fill in an address/],
    ["a return collected from another airport", { return_pickup_airport: "LGW", return_pickup_terminal: "N" }, /an airport the outward journey went to/],
    ["a single date instead of an outbound>return pair", { verified_travel_dates: "2026-06-10" }, /needs a return date/],
    ["a return date before the outbound date", { verified_travel_dates: "2026-06-10>2026-06-09" }, /is before/],
  ])("rejects a return fare with %s", async (_label, change, expected) => {
    expect((await messages({ ...returnRow, ...change })).join("\n")).toMatch(expected);
  });

  it("accepts a return fare whose return route is unconfirmed (it will never be priced)", async () => {
    const r = await run({ ...returnRow, return_route: "unconfirmed", return_pickup_airport: "", return_pickup_terminal: "" });
    expect(r.ok && r.fares[0].returnLeg).toEqual({ status: "unconfirmed" });
  });

  it("rejects duplicate ids and two fares for the same booking with the same status", async () => {
    expect(await messages(base, { ...base, reference_total_gbp: "60" })).toContain("Duplicate id");
    const sameBooking = { ...base, id: "OTHER", pickup_line1: "1, test street." };
    expect((await messages(base, sameBooking)).join()).toMatch(/same booking .* same status \(approved\)/);
  });

  it("allows one pending re-check beside the approved fare", async () => {
    const recheck = { ...base, id: "RECHECK", status: "pending", approved_by: "", approved_at: "", reference_total_gbp: "55" };
    expect((await run(base, recheck)).ok).toBe(true);
  });

  it("rejects the whole import when any row is invalid, reporting the spreadsheet row", async () => {
    const r = await run(base, { ...returnRow }, { ...base, id: "BAD", dropoff_terminal: "T9" });
    expect(r.ok).toBe(false);
    expect("fares" in r).toBe(false);
    expect(!r.ok && r.problems).toEqual([expect.objectContaining({ row: 4, id: "BAD" })]);
  });

  it("checks the header row", async () => {
    const missing = await importFares(COLUMNS.filter((c) => c !== "checked_at").join(",") + "\n", { now });
    expect(!missing.ok && missing.problems[0].message).toBe("Missing columns: checked_at");
    const extra = await importFares([...COLUMNS, "price_guess"].join(",") + "\n", { now });
    expect(!extra.ok && extra.problems[0].message).toBe("Unknown columns: price_guess");
    expect((await importFares("", { now })).ok).toBe(false);
  });

  it("rejects rows with the wrong number of cells", async () => {
    const r = await importFares(`${COLUMNS.join(",")}\nonly,three,cells\n`, { now });
    expect(!r.ok && r.problems[0]).toMatchObject({ row: 2, message: "Has 3 cells but the header has 34" });
  });

  it("imports a header-only file as an empty fare list", async () => {
    expect(await importFares(csv(), { now })).toEqual({ ok: true, fares: [], warnings: [] });
  });
});

describe("fares:import command (plain Node, as the owner runs it)", () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("VITEST"))) as NodeJS.ProcessEnv;
  const cli = (...args: string[]) =>
    spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/fares-import.mjs", ...args], {
      cwd: ROOT,
      env,
      encoding: "utf8",
    });

  it("writes valid fares, and leaves the file untouched when any row is invalid", () => {
    const dir = mkdtempSync(join(tmpdir(), "gat-fares-"));
    const out = join(dir, "fares.json");
    const good = join(dir, "good.csv");
    const bad = join(dir, "bad.csv");
    writeFileSync(good, csv(base));
    writeFileSync(bad, csv(base, { ...base, id: "BAD", reference_vehicle: "Executive People Carrier", galaxy_vehicle: "" }));

    const ok = cli(good, "--out", out);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("1 fare(s) valid: 1 approved, 0 pending.");
    const written = readFileSync(out, "utf8");
    expect(JSON.parse(written)[0].referenceTotalPence).toBe(5000);

    const rejected = cli(bad, "--out", out);
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain("Import rejected. Nothing was written.");
    expect(rejected.stderr).toContain("Row 3 (BAD): executive_people_carrier is excluded from pricing");
    expect(readFileSync(out, "utf8")).toBe(written);
  });

  it("checks without writing on a dry run", () => {
    const dir = mkdtempSync(join(tmpdir(), "gat-fares-"));
    const good = join(dir, "good.csv");
    writeFileSync(good, csv(base));
    const r = cli(good, "--dry-run", "--out", join(dir, "never.json"));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Dry run: nothing was written.");
    expect(() => readFileSync(join(dir, "never.json"))).toThrow();
  });

  it("shows usage when no file is given", () => {
    expect(cli().status).toBe(2);
  });

  it("leaves the website's fare file empty", () => {
    expect(readFileSync(join(ROOT, "src/data/reference-fares.json"), "utf8").trim()).toBe("[]");
  });
});
