import type { Luggage, Vehicle } from "./types";

/**
 * Why a vehicle can't carry this group, or null if it can.
 * A spare large-case space can hold a small case, not the other way round.
 */
export function capacityProblem(vehicle: Vehicle, passengers: number, luggage: Luggage): string | null {
  if (passengers > vehicle.maxPassengers) {
    return `Seats up to ${vehicle.maxPassengers} passengers`;
  }
  if (luggage.large > vehicle.maxLargeCases) {
    return `Takes up to ${vehicle.maxLargeCases} large cases`;
  }
  const spareLarge = vehicle.maxLargeCases - luggage.large;
  if (luggage.small > vehicle.maxSmallCases + spareLarge) {
    return "Not enough room for this much hand luggage";
  }
  return null;
}

export function fitsAnyVehicle(fleet: Vehicle[], passengers: number, luggage: Luggage): boolean {
  return fleet.some((v) => capacityProblem(v, passengers, luggage) === null);
}
