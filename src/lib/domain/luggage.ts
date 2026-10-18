import { luggageCategories, type Luggage, type LuggageCategory, type LuggageCounts } from "./types";

/** Customer-facing names for each luggage category. */
export const luggageCategoryLabels: Record<LuggageCategory, string> = {
  none: "None",
  hand_luggage: "Hand luggage",
  suitcases: "Suitcases",
};

export function isLuggageCategory(value: unknown): value is LuggageCategory {
  return typeof value === "string" && (luggageCategories as readonly string[]).includes(value);
}

/** Customer-facing luggage summary, preferring the luggage category when given. */
export function describeLuggage(
  luggage: Luggage,
  category?: LuggageCategory,
  handLuggageToo?: boolean,
  counts?: LuggageCounts,
): string {
  const hand = category === "hand_luggage" || (category === "suitcases" && handLuggageToo);
  if (counts && (counts.suitcases || counts.handLuggage)) {
    const parts = [
      category === "suitcases" && counts.suitcases && plural(counts.suitcases, "suitcase"),
      hand && counts.handLuggage && plural(counts.handLuggage, "hand luggage bag"),
    ].filter((p): p is string => Boolean(p));
    if (parts.length) return parts.join(" and ");
  }
  if (category === "suitcases" && handLuggageToo) return "Suitcases and hand luggage";
  if (category) return luggageCategoryLabels[category];
  return `${luggage.large} large, ${luggage.small} small`;
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
