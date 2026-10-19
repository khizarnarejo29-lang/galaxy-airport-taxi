#!/usr/bin/env node
/**
 * Measures real driving miles (Google Routes) between the six sample postcodes
 * and each airport, both ways, and saves them to src/config/road-miles.json.
 * The tariff tests use that file to check prices stay at least £2 under the
 * reference website with real miles, before ROAD_DISTANCE=google is switched on.
 *
 *   npm run road-miles
 *
 * Reads GOOGLE_MAPS_API_KEY from the environment or .env.local. The key is
 * never printed or saved. About 60 route requests per run.
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { registerTypeScriptPaths } from "./fares-import.mjs";

export const OUT = new URL("../src/config/road-miles.json", import.meta.url);

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* no .env.local: the key may be in the environment */
  }
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set (add it to .env.local).");

  registerTypeScriptPaths();
  const [{ exampleAreas }, { airports }, { googleRoutesDistance, estimatedDistance }] = await Promise.all([
    import("../src/lib/pricing/example-fares.ts"),
    import("../src/lib/domain/airports.ts"),
    import("../src/lib/services/distance.ts"),
  ]);
  // No fallback: a failed request must stop the run, not save an estimate as a real distance.
  const failing = { routeMiles: async () => { throw new Error("Google Routes request failed (check the key has the Routes API enabled)."); } };
  const google = googleRoutesDistance(key, { fallback: failing });
  const estimate = estimatedDistance();

  const miles = {};
  console.log("From → to: estimate / Google road miles");
  for (const area of exampleAreas) {
    for (const airport of airports) {
      for (const [from, to, name] of [
        [area, airport, `${area.postcode}>${airport.code}`],
        [airport, area, `${airport.code}>${area.postcode}`],
      ]) {
        const real = await google.routeMiles([from, to]);
        miles[name] = real;
        console.log(`  ${name.padEnd(14)} ${String(await estimate.routeMiles([from, to])).padStart(5)} / ${String(real).padStart(5)}`);
      }
    }
  }
  writeFileSync(OUT, `${JSON.stringify({ measured: new Date().toISOString().slice(0, 10), miles }, null, 2)}\n`);
  console.log(`\nSaved ${Object.keys(miles).length} distances to src/config/road-miles.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 2;
  });
}
