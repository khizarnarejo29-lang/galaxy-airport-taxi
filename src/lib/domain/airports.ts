import type { Airport, AirportCode } from "./types";

/** Terminals in public use. Confirm before launch; airports do change them. */
export const airports: Airport[] = [
  {
    code: "LHR",
    name: "Heathrow Airport",
    shortName: "Heathrow",
    slug: "heathrow-airport-taxi",
    lat: 51.47,
    lng: -0.4543,
    terminals: [
      { id: "T2", name: "Terminal 2" },
      { id: "T3", name: "Terminal 3" },
      { id: "T4", name: "Terminal 4" },
      { id: "T5", name: "Terminal 5" },
    ],
  },
  {
    code: "LGW",
    name: "Gatwick Airport",
    shortName: "Gatwick",
    slug: "gatwick-airport-taxi",
    lat: 51.1537,
    lng: -0.1821,
    terminals: [
      { id: "N", name: "North Terminal" },
      { id: "S", name: "South Terminal" },
    ],
  },
  {
    code: "STN",
    name: "Stansted Airport",
    shortName: "Stansted",
    slug: "stansted-airport-taxi",
    lat: 51.886,
    lng: 0.2389,
    terminals: [],
  },
  {
    code: "LTN",
    name: "Luton Airport",
    shortName: "Luton",
    slug: "luton-airport-taxi",
    lat: 51.8747,
    lng: -0.3683,
    terminals: [],
  },
  {
    code: "LCY",
    name: "London City Airport",
    shortName: "London City",
    slug: "london-city-airport-taxi",
    lat: 51.5048,
    lng: 0.0495,
    terminals: [],
  },
];

export const airportCodes = airports.map((a) => a.code) as [AirportCode, ...AirportCode[]];

export function getAirport(code: string): Airport | undefined {
  return airports.find((a) => a.code === code);
}

export function requiresTerminal(code: string): boolean {
  return (getAirport(code)?.terminals.length ?? 0) > 1;
}
