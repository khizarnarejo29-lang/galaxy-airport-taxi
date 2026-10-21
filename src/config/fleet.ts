import type { Vehicle } from "@/lib/domain/types";

/**
 * Vehicle classes offered online. Capacities are typical figures and should be
 * confirmed against the real fleet before launch.
 */
export const fleet: Vehicle[] = [
  {
    id: "saloon",
    name: "Saloon",
    maxPassengers: 4,
    maxLargeCases: 2,
    maxSmallCases: 2,
    summary: "For one to four passengers with normal luggage.",
  },
  {
    id: "estate",
    name: "Estate",
    maxPassengers: 4,
    maxLargeCases: 3,
    maxSmallCases: 3,
    summary: "Like a saloon, with a bigger boot for an extra suitcase.",
  },
  {
    id: "executive",
    name: "Executive",
    maxPassengers: 3,
    maxLargeCases: 2,
    maxSmallCases: 2,
    summary: "A higher-end car for business trips and special occasions.",
  },
  {
    id: "mpv",
    name: "MPV",
    maxPassengers: 6,
    maxLargeCases: 4,
    maxSmallCases: 4,
    summary: "People carrier for families and small groups.",
  },
  {
    id: "minibus",
    name: "8-Seater",
    maxPassengers: 8,
    maxLargeCases: 8,
    maxSmallCases: 8,
    summary: "For groups of up to eight, with room for their luggage.",
  },
];

export function getVehicle(id: string): Vehicle | undefined {
  return fleet.find((v) => v.id === id);
}
