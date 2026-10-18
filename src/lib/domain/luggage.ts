import { luggageCategories, type Luggage, type LuggageCategory } from "./types";

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
export function describeLuggage(luggage: Luggage, category?: LuggageCategory, handLuggageToo?: boolean): string {
  if (category === "suitcases" && handLuggageToo) return "Suitcases and hand luggage";
  if (category) return luggageCategoryLabels[category];
  return `${luggage.large} large, ${luggage.small} small`;
}
