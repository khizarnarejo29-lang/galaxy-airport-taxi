#!/usr/bin/env node
/**
 * Reports on the stored reference fares (src/data/reference-fares.json):
 * expired fares, fares expiring within 24 hours, pending fares, and approved
 * fares whose verified travel dates have all passed.
 *
 *   npm run fares:report
 *
 * A fare is valid for exactly 168 hours (7 days) from its check time, the
 * same rule the website prices with. This report only reads the file.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DEFAULT_OUT, loadFareRules } from "./fares-import.mjs";

const HOUR_MS = 60 * 60 * 1000;
export const EXPIRING_WITHIN_HOURS = 24;

const londonTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "medium",
  timeStyle: "short",
});

/** Sorts every stored fare into the report's groups. Pure: pass `now` to test. */
export async function buildReport(data, { now = new Date() } = {}) {
  const rules = await loadFareRules();
  const problems = rules.checkFareData(data, now);
  const report = { now, total: Array.isArray(data) ? data.length : 0, problems, expired: [], expiringSoon: [], pending: [], datesPassed: [], usable: [] };
  if (problems.length) return report;

  const today = rules.londonToday(now);
  for (const fare of data) {
    const validUntil = rules.fareValidUntil(fare);
    const hoursLeft = (validUntil.getTime() - now.getTime()) / HOUR_MS;
    const upcomingDates = fare.verifiedTravelDates.filter((d) => d.outbound >= today);
    const item = { fare, validUntil, hoursLeft, upcomingDates };

    if (hoursLeft <= 0) report.expired.push(item);
    else if (hoursLeft <= EXPIRING_WITHIN_HOURS) report.expiringSoon.push(item);

    if (!rules.isFareApproved(fare)) report.pending.push(item);
    else if (upcomingDates.length === 0) report.datesPassed.push(item);
    else if (hoursLeft > 0) report.usable.push(item);
  }
  for (const group of ["expired", "expiringSoon", "pending", "datesPassed", "usable"]) {
    report[group].sort((a, b) => a.validUntil - b.validUntil);
  }
  return report;
}

const describe = ({ fare }) =>
  `${fare.id} — ${endLabel(fare.pickup)} → ${endLabel(fare.dropoff)}, ${fare.tripType.replace("_", "-")}, ${fare.referenceVehicle}, ${fare.status}`;

/** A postcode, or an airport code and terminal. */
function endLabel(end) {
  return end.kind === "airport" ? `${end.airport}${end.terminal ? ` ${end.terminal}` : ""}` : end.postcode;
}

const hours = (h) => (h >= 1 ? `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min` : `${Math.max(0, Math.round(h * 60))} min`);

/** Plain-text report for the owner. */
export function formatReport(report) {
  const lines = [`Reference fare report — ${londonTime.format(report.now)} (London time)`, ""];

  if (report.problems.length) {
    lines.push(
      "THE FARE FILE IS INVALID. While it is invalid the website prices nothing (every journey shows “Price on request”).",
      ...report.problems.map((p) => `  • ${p.index >= 0 ? `Entry ${p.index + 1}` : "File"}${p.id ? ` (${p.id})` : ""}: ${p.message}`),
    );
    return lines.join("\n");
  }

  if (report.total === 0) {
    lines.push("No reference fares are stored. Every journey currently shows “Price on request”.");
    return lines.join("\n");
  }

  const section = (title, items, detail) => {
    lines.push(`${title} (${items.length})`);
    if (items.length === 0) lines.push("  None.");
    for (const item of items) lines.push(`  • ${describe(item)}`, `      ${detail(item)}`);
    lines.push("");
  };

  lines.push(`${report.total} fare(s) stored. Each fare is valid for exactly 168 hours from its check time.`, "");
  section("EXPIRED — no longer priced; re-check or remove", report.expired, (i) => `Expired ${londonTime.format(i.validUntil)}`);
  section(`EXPIRING WITHIN ${EXPIRING_WITHIN_HOURS} HOURS — re-check soon`, report.expiringSoon, (i) => `Expires ${londonTime.format(i.validUntil)} (${hours(i.hoursLeft)} left)`);
  section("PENDING — never used for pricing until approved", report.pending, (i) => `Checked by ${i.fare.checkedBy}; ${i.hoursLeft > 0 ? `valid until ${londonTime.format(i.validUntil)}` : "already expired"}`);
  section("ALL VERIFIED TRAVEL DATES HAVE PASSED — can't price any journey", report.datesPassed, (i) =>
    i.fare.verifiedTravelDates.length ? `Last verified date ${i.fare.verifiedTravelDates.map((d) => d.outbound).sort().at(-1)}` : "No verified travel dates listed",
  );
  section("IN USE — approved, in date and with upcoming verified dates", report.usable, (i) => `Valid until ${londonTime.format(i.validUntil)} (${hours(i.hoursLeft)} left); next date ${i.upcomingDates.map((d) => d.outbound).sort()[0]}`);
  return lines.join("\n").trimEnd();
}

export async function main(argv = process.argv.slice(2)) {
  let file = DEFAULT_OUT;
  let now = new Date();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file") file = argv[++i];
    else if (argv[i] === "--now") now = new Date(argv[++i]); // "What will it look like at…?"
    else {
      console.error("Usage: npm run fares:report [-- --file <fares.json>] [--now <ISO time>]");
      return 2;
    }
  }
  if (!file || Number.isNaN(now.getTime())) {
    console.error("Usage: npm run fares:report [-- --file <fares.json>] [--now <ISO time>]");
    return 2;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`Can't read ${file} as JSON: ${err.message}`);
    return 1;
  }
  const report = await buildReport(data, { now });
  console.log(formatReport(report));
  return report.problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
