#!/usr/bin/env node
/**
 * Imports owner-entered reference fares from a CSV file (see
 * docs/REFERENCE_FARES.md) into src/data/reference-fares.json.
 *
 *   npm run fares:import -- path/to/fares.csv            check and write
 *   npm run fares:import -- path/to/fares.csv --dry-run  check only
 *
 * Every row is checked with the same rules the website uses. If any row is
 * invalid nothing is written. Nothing here contacts the reference website.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = new URL("../", import.meta.url);
export const DEFAULT_OUT = fileURLToPath(new URL("src/data/reference-fares.json", ROOT));
const HOUR_MS = 60 * 60 * 1000;

/** CSV columns, in template order. */
export const COLUMNS = [
  "id",
  "status",
  "source_url",
  "pickup_line1",
  "pickup_postcode",
  "pickup_airport",
  "pickup_terminal",
  "dropoff_line1",
  "dropoff_postcode",
  "dropoff_airport",
  "dropoff_terminal",
  "trip_type",
  "return_route",
  "return_pickup_line1",
  "return_pickup_postcode",
  "return_pickup_airport",
  "return_pickup_terminal",
  "return_stops",
  "reference_vehicle",
  "galaxy_vehicle",
  "confirmed_parties",
  "stops",
  "meet_and_greet",
  "child_seats",
  "verified_travel_dates",
  "reference_total_gbp",
  "currency",
  "vat_included",
  "checked_at",
  "checked_by",
  "approved_by",
  "approved_at",
  "expires_at",
  "notes",
];

/** Vehicle names as they appear on the reference website's fare list. */
const VEHICLE_NAMES = {
  "saloon car": "saloon_car",
  "executive car": "executive_car",
  "estate car": "estate_car",
  "people carrier": "people_carrier",
  "executive people carrier": "executive_people_carrier",
  "8 seater minibus": "minibus_8_seater",
};

const SOURCE_HOSTS = new Set(["www.airporttaxis-uk.co.uk", "airporttaxis-uk.co.uk"]);

/** Lets plain Node load the website's TypeScript modules ("@/…" paths, no file extensions). */
function registerTypeScriptPaths() {
  const hooks = `
    import { statSync } from "node:fs";
    import { fileURLToPath } from "node:url";
    let src;
    export function initialize(data) { src = data.src; }
    const isFile = (u) => { try { return statSync(fileURLToPath(u)).isFile(); } catch { return false; } };
    export async function resolve(spec, ctx, next) {
      let base = null;
      if (spec.startsWith("@/")) base = new URL(spec.slice(2), src).href;
      else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith(src)) base = new URL(spec, ctx.parentURL).href;
      if (base) for (const c of [base, base + ".ts", base + "/index.ts"]) if (isFile(c)) return { url: c, shortCircuit: true };
      return next(spec, ctx);
    }`;
  register(`data:text/javascript,${encodeURIComponent(hooks)}`, { data: { src: new URL("src/", ROOT).href } });
}

let rulesPromise;

/** The website's own fare rules: schema, vehicle mapping, airports and the 168-hour expiry. */
export function loadFareRules() {
  rulesPromise ??= (async () => {
    // Vitest already understands the project's TypeScript; plain Node needs the path hooks.
    if (!process.env.VITEST) registerTypeScriptPaths();
    const [schema, match, vehicles, airports, dates] = await Promise.all([
      import("../src/lib/reference-fares/schema.ts"),
      import("../src/lib/reference-fares/match.ts"),
      import("../src/config/reference-vehicles.ts"),
      import("../src/lib/domain/airports.ts"),
      import("../src/lib/utils/dates.ts"),
    ]);
    return {
      checkFareData: schema.checkFareData,
      fareValidUntil: match.fareValidUntil,
      isFareApproved: match.isFareApproved,
      vehicleMapping: vehicles.vehicleMapping,
      validForDays: vehicles.referenceFareRules.validForDays,
      airports: airports.airports,
      londonToday: dates.londonToday,
    };
  })();
  return rulesPromise;
}

/**
 * RFC 4180 CSV: quoted fields may contain commas, line breaks and doubled
 * quotes (""). Handles a UTF-8 byte-order mark and Windows line endings.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      if (field.trim() !== "") throw new Error(`Unexpected quote inside an unquoted field near "${field}"`);
      field = "";
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (quoted) throw new Error("A quoted field is never closed");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Spreadsheets often add empty lines at the end.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const list = (v) =>
  v
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

/** Converts one CSV record into a fare. Field errors are collected, never guessed around. */
function toFare(rec, rules, problem) {
  const v = (col) => (rec[col] ?? "").trim();
  const fail = (col, message) => problem(`${col}: ${message}`);

  const yesNo = (col) => {
    const s = v(col).toLowerCase();
    if (s === "yes") return true;
    if (s === "no") return false;
    fail(col, 'use "yes" or "no"');
    return false;
  };

  const integer = (col) => {
    const s = v(col);
    if (!/^\d+$/.test(s)) {
      fail(col, "use a whole number, e.g. 0");
      return 0;
    }
    return Number(s);
  };

  /** Multi-terminal airports need a terminal id; single-terminal airports must leave it blank. */
  const terminal = (col, airport) => {
    const t = v(col).toUpperCase();
    if (airport.terminals.length > 1) {
      if (!airport.terminals.some((x) => x.id === t)) {
        fail(col, `${airport.name} needs one of ${airport.terminals.map((x) => x.id).join(", ")}`);
      }
      return t || null;
    }
    if (t) fail(col, `leave blank: ${airport.name} has a single terminal`);
    return null;
  };

  /**
   * One end of a leg from its four columns ("pickup", "dropoff" or "return_pickup"):
   * an airport (airport, plus terminal where needed) or an address (line1 and postcode), never both.
   */
  const end = (prefix) => {
    const [line1, postcode, airportCol, terminalCol] = ["line1", "postcode", "airport", "terminal"].map((c) => `${prefix}_${c}`);
    const code = v(airportCol).toUpperCase();
    if (code) {
      if (v(line1) || v(postcode)) fail(airportCol, `fill in either an airport or an address, not both`);
      const airport = rules.airports.find((a) => a.code === code);
      if (!airport) {
        fail(airportCol, `use one of ${rules.airports.map((a) => a.code).join(", ")}`);
        return { kind: "airport", airport: code, terminal: v(terminalCol) || null };
      }
      return { kind: "airport", airport: airport.code, terminal: terminal(terminalCol, airport) };
    }
    if (v(terminalCol)) fail(terminalCol, "leave blank unless this end is an airport");
    if (!v(line1) && !v(postcode)) fail(line1, `fill in an address (${line1} and ${postcode}) or an airport (${airportCol})`);
    return { kind: "address", line1: v(line1), postcode: v(postcode) };
  };

  // Source URL: recorded in notes, as the fare format has no field of its own.
  const source = v("source_url");
  let sourceOk = false;
  try {
    const u = new URL(source);
    sourceOk = u.protocol === "https:" && SOURCE_HOSTS.has(u.hostname);
  } catch {
    /* reported below */
  }
  if (!sourceOk) fail("source_url", "use the https://www.airporttaxis-uk.co.uk/… page address where the fare was checked");

  // Reference vehicle, and the Galaxy vehicle it maps to.
  const vehicleText = v("reference_vehicle").toLowerCase();
  const referenceVehicle = VEHICLE_NAMES[vehicleText] ?? (Object.values(VEHICLE_NAMES).includes(vehicleText) ? vehicleText : null);
  if (!referenceVehicle) {
    fail("reference_vehicle", `use one of: ${Object.keys(VEHICLE_NAMES).map((n) => n.replace(/\b\w/g, (c) => c.toUpperCase())).join(", ")}`);
  }
  const galaxy = v("galaxy_vehicle").toLowerCase();
  if (galaxy && referenceVehicle) {
    const mapped = Object.entries(rules.vehicleMapping).find(([, ref]) => ref === referenceVehicle)?.[0];
    if (!mapped) fail("galaxy_vehicle", `${v("reference_vehicle")} has no Galaxy vehicle and can't be priced`);
    else if (galaxy !== mapped) fail("galaxy_vehicle", `${v("reference_vehicle")} maps to Galaxy "${mapped}", not "${galaxy}"`);
  }

  // Passenger count and luggage category: "1p suitcases; 2p hand luggage; 3p none".
  const confirmedParties = list(v("confirmed_parties")).map((p) => {
    const m = /^(\d+)p\s+(none|hand[\s_-]*luggage|suitcases)$/i.exec(p.trim().replace(/\s+/g, " "));
    if (!m) {
      fail("confirmed_parties", `"${p}" should look like "2p suitcases", "2p hand luggage" or "2p none"`);
      return { passengers: 0, luggage: "none" };
    }
    return { passengers: +m[1], luggage: m[2].toLowerCase().replace(/[\s_-]+/g, "_") };
  });

  // Verified travel dates: "2026-10-20" or, for returns, "2026-10-20>2026-10-27".
  const verifiedTravelDates = list(v("verified_travel_dates")).map((d) => {
    const [outbound, back, extra] = d.split(">").map((s) => s.trim());
    if (extra !== undefined) fail("verified_travel_dates", `"${d}" has more than one ">"`);
    return back ? { outbound, return: back } : { outbound };
  });

  // Reference total in pounds, converted to whole pence without rounding errors.
  const priceText = v("reference_total_gbp").replace(/^£/, "");
  let referenceTotalPence = 0;
  const pm = /^(\d+)(?:\.(\d{1,2}))?$/.exec(priceText);
  if (!pm) fail("reference_total_gbp", 'use pounds and pence, e.g. 84.00 (no commas)');
  else referenceTotalPence = Number(pm[1]) * 100 + Number((pm[2] ?? "0").padEnd(2, "0"));

  // Return route.
  const tripType = v("trip_type").toLowerCase();
  // The way back always ends at the outward pickup, so only its pickup and stops are recorded.
  const returnColumns = [
    "return_route",
    "return_pickup_line1",
    "return_pickup_postcode",
    "return_pickup_airport",
    "return_pickup_terminal",
    "return_stops",
  ];
  let returnLeg;
  if (tripType === "return") {
    const route = v("return_route").toLowerCase();
    if (route === "confirmed") {
      returnLeg = { status: "confirmed", pickup: end("return_pickup"), stops: list(v("return_stops")) };
    } else if (route === "unconfirmed") {
      returnLeg = { status: "unconfirmed" };
      for (const c of returnColumns.slice(1)) if (v(c)) fail(c, "leave blank when the return route is unconfirmed");
    } else fail("return_route", 'use "confirmed" or "unconfirmed" for a return fare');
  } else {
    for (const c of returnColumns) if (v(c)) fail(c, "leave blank on a one-way fare");
  }

  const approvedAt = v("approved_at");
  const notes = [`Source: ${source}`, v("notes")].filter(Boolean).join(" | ");

  return {
    id: v("id"),
    status: v("status").toLowerCase(),
    pickup: end("pickup"),
    dropoff: end("dropoff"),
    tripType,
    ...(returnLeg ? { returnLeg } : {}),
    referenceVehicle: referenceVehicle ?? vehicleText,
    confirmedParties,
    stops: list(v("stops")),
    extras: { meetAndGreet: yesNo("meet_and_greet"), childSeats: integer("child_seats") },
    verifiedTravelDates,
    currency: v("currency").toUpperCase(),
    vatIncluded: yesNo("vat_included"),
    referenceTotalPence,
    checkedAt: v("checked_at"),
    checkedBy: v("checked_by"),
    approvedBy: v("approved_by"),
    approvedAt: approvedAt || null,
    notes,
  };
}

/**
 * @typedef {{ row: number | null, id?: string, message: string }} ImportProblem
 * @typedef {{ ok: true, fares: import("../src/lib/reference-fares/schema.ts").ReferenceFare[], warnings: ImportProblem[] }} ImportSuccess
 * @typedef {{ ok: false, problems: ImportProblem[], warnings: ImportProblem[] }} ImportFailure
 */

/**
 * Checks a whole CSV. Returns every fare, or every problem — never a mix:
 * one bad row rejects the whole import.
 * @param {string} csvText
 * @param {{ now?: Date }} [options]
 * @returns {Promise<ImportSuccess | ImportFailure>}
 */
export async function importFares(csvText, { now = new Date() } = {}) {
  const rules = await loadFareRules();
  const problems = [];
  const warnings = [];

  let rows;
  try {
    rows = parseCsv(csvText);
  } catch (err) {
    return { ok: false, problems: [{ row: null, message: `The file isn't valid CSV: ${err.message}` }], warnings };
  }
  if (rows.length === 0) return { ok: false, problems: [{ row: null, message: "The file is empty (no header row)" }], warnings };

  const header = rows[0].map((h) => h.trim());
  const missing = COLUMNS.filter((c) => !header.includes(c));
  const unknown = header.filter((h) => !COLUMNS.includes(h));
  const repeated = header.filter((h, i) => header.indexOf(h) !== i);
  if (missing.length) problems.push({ row: 1, message: `Missing columns: ${missing.join(", ")}` });
  if (unknown.length) problems.push({ row: 1, message: `Unknown columns: ${unknown.join(", ")}` });
  if (repeated.length) problems.push({ row: 1, message: `Repeated columns: ${repeated.join(", ")}` });
  if (problems.length) return { ok: false, problems, warnings };

  const fares = [];
  rows.slice(1).forEach((cells, i) => {
    const row = i + 2; // Spreadsheet row number: the header is row 1.
    if (cells.length !== header.length) {
      problems.push({ row, message: `Has ${cells.length} cells but the header has ${header.length}` });
      return;
    }
    const rec = Object.fromEntries(header.map((h, j) => [h, cells[j]]));
    const id = rec.id?.trim() || undefined;
    const fare = toFare(rec, rules, (message) => problems.push({ row, id, message }));

    // The expiry is always the check time + 168 hours; any value typed in the sheet is ignored.
    const typed = rec.expires_at?.trim();
    const checked = Date.parse(fare.checkedAt);
    if (typed && !Number.isNaN(checked)) {
      const expected = checked + rules.validForDays * 24 * HOUR_MS;
      if (Date.parse(typed) !== expected) {
        warnings.push({ row, id, message: `expires_at ignored: the fare expires at ${new Date(expected).toISOString()} (check time + 168 hours)` });
      }
    }
    fares.push({ row, fare });
  });

  // The website's own checks: schema, future check times, approval, exclusions, duplicates.
  for (const p of rules.checkFareData(fares.map((f) => f.fare), now)) {
    const entry = fares[p.index];
    problems.push({ row: entry?.row ?? null, id: p.id ?? entry?.fare.id, message: p.message });
  }

  if (problems.length) return { ok: false, problems, warnings };
  return { ok: true, fares: fares.map((f) => f.fare), warnings };
}

/** Writes via a temporary file so a failure can never leave a half-written fare file. */
export function writeFaresAtomically(path, fares) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(fares, null, 2)}\n`);
  renameSync(tmp, path);
}

const describe = (p) => `${p.row ? `Row ${p.row}` : "File"}${p.id ? ` (${p.id})` : ""}: ${p.message}`;

export async function main(argv = process.argv.slice(2)) {
  let file;
  let out = DEFAULT_OUT;
  let dryRun = false;
  let usageError = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--out") out = argv[++i]; // Used by tests to write somewhere other than the real fare file.
    else if (a.startsWith("--") || file) usageError = true;
    else file = a;
  }
  if (usageError || !file || !out) {
    console.error("Usage: npm run fares:import -- <fares.csv> [--dry-run]");
    return 2;
  }

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    console.error(`Can't read ${file}: ${err.message}`);
    return 2;
  }

  const result = await importFares(text);
  for (const w of result.warnings) console.warn(`Warning – ${describe(w)}`);
  if (!result.ok) {
    console.error(`Import rejected. Nothing was written. Fix these ${result.problems.length} problem(s) and try again:`);
    for (const p of result.problems) console.error(`  • ${describe(p)}`);
    return 1;
  }

  const approved = result.fares.filter((f) => f.status === "approved").length;
  const summary = `${result.fares.length} fare(s) valid: ${approved} approved, ${result.fares.length - approved} pending.`;
  if (dryRun) {
    console.log(`${summary} Dry run: nothing was written.`);
    return 0;
  }
  writeFaresAtomically(out, result.fares);
  console.log(`${summary} Written to ${out}.`);
  if (result.fares.length === 0) console.log("The file is now empty: every journey will show “Price on request”.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
