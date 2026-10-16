/**
 * The stored reference fares. Owner-approved entries only are ever priced;
 * the file ships empty. Invalid data fails loudly rather than pricing anything.
 */
import data from "@/data/reference-fares.json";
import { checkFareData, referenceFareSchema, type ReferenceFare } from "./schema";

export function loadReferenceFares(raw: unknown = data, now: Date = new Date()): ReferenceFare[] {
  const problems = checkFareData(raw, now);
  if (problems.length) {
    const lines = problems.map((p) => `  #${p.index}${p.id ? ` (${p.id})` : ""}: ${p.message}`);
    throw new Error(`Reference fare data is invalid:\n${lines.join("\n")}`);
  }
  return (raw as unknown[]).map((entry) => referenceFareSchema.parse(entry));
}

/**
 * The fares to price with right now. Invalid data prices nothing (every
 * vehicle becomes price on request) and is logged for the operator.
 */
export function currentReferenceFares(now: Date = new Date()): ReferenceFare[] {
  try {
    return loadReferenceFares(data, now);
  } catch (err) {
    console.error("[reference-fares] fare data rejected; pricing nothing", err);
    return [];
  }
}

export { checkFareData, type ReferenceFare } from "./schema";
export { matchReferenceFare, galaxyFareFromReference, type FareMatch, type FareQuery } from "./match";
