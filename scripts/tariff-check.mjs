#!/usr/bin/env node
/**
 * Checks the location tariff (src/config/pricing.ts) against the stored
 * reference fares: for each fare, what the tariff would charge for the same
 * journey and vehicle, and whether that is more than the reference total
 * minus £2. Run it after changing tariff figures, before switching them on.
 *
 *   npm run tariff:check
 *
 * Needs internet access (postcodes.io) to place each address. Only reads files.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DEFAULT_OUT, registerTypeScriptPaths } from "./fares-import.mjs";

const gbp = (pence) => `£${(pence / 100).toFixed(2)}`;

/** One line per fare, then a summary. Pure: used by the tests. */
export function formatTariffCheck(rows, { version, isPlaceholder }) {
  const out = [`Tariff ${version}${isPlaceholder ? " (PLACEHOLDER figures, not in use on the website)" : ""}`, ""];
  if (rows.length === 0) out.push("No reference fares stored yet: nothing to compare.");
  for (const r of rows) {
    const head = `${r.id} [${r.status}] ${r.vehicleId ?? "?"}: reference ${gbp(r.referenceTotal)}, most allowed ${gbp(r.ceiling)}`;
    if (r.verdict === "not_checked") out.push(`  SKIPPED  ${head} (${r.note})`);
    else if (r.verdict === "too_high") out.push(`  TOO HIGH ${head}, tariff ${gbp(r.tariffTotal)} (${gbp(r.tariffTotal - r.ceiling)} over)`);
    else out.push(`  OK       ${head}, tariff ${gbp(r.tariffTotal)} (${gbp(r.ceiling - r.tariffTotal)} under)`);
  }
  const high = rows.filter((r) => r.verdict === "too_high").length;
  const checked = rows.filter((r) => r.verdict !== "not_checked").length;
  if (high) out.push("", `${high} fare(s) where the tariff is more than reference minus £2. Lower those figures.`);
  else if (checked) out.push("", `The tariff is at least £2 under all ${checked} reference fare(s) it could check.`);
  return out.join("\n");
}

async function main() {
  registerTypeScriptPaths();
  const [check, config, schema, postcodes, distance] = await Promise.all([
    import("../src/lib/pricing/tariff-check.ts"),
    import("../src/config/pricing.ts"),
    import("../src/lib/reference-fares/schema.ts"),
    import("../src/lib/services/location/postcodes-io.ts"),
    import("../src/lib/services/distance.ts"),
  ]);
  const fares = JSON.parse(readFileSync(DEFAULT_OUT, "utf8")).map((f) => schema.referenceFareSchema.parse(f));
  const lookup = async (postcode) => {
    const loc = await postcodes.postcodesIo.lookupPostcode(postcode);
    return loc && { lat: loc.lat, lng: loc.lng };
  };
  const rows = await check.checkTariffAgainstFares(fares, config.pricing, lookup, distance.estimatedDistance());
  console.log(formatTariffCheck(rows, config.pricing));
  process.exitCode = rows.some((r) => r.verdict === "too_high") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 2;
  });
}
