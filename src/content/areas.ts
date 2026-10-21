import { airports } from "@/lib/domain/airports";
import { haversineMiles } from "@/lib/domain/geo";
import type { AirportCode } from "@/lib/domain/types";
import type { NamedPoint } from "@/lib/pricing/route-fares";

export interface Area extends NamedPoint {
  slug: string;
  /** The London borough it is in. */
  borough: string;
  /** A shorter name for page titles, when the full one is long. */
  shortName?: string;
}

/**
 * Areas with their own page. Centre points as Google Maps gives them for the
 * area name (2026-10-21). Only facts that follow from the point are stated.
 */
export const areas: Area[] = [
  { slug: "croydon", name: "Croydon", borough: "Croydon", region: "London", lat: 51.377, lng: -0.0957 },
  { slug: "wembley", name: "Wembley", borough: "Brent", region: "London", lat: 51.556, lng: -0.2796 },
  { slug: "ealing", name: "Ealing", borough: "Ealing", region: "London", lat: 51.5133, lng: -0.3043 },
  { slug: "romford", name: "Romford", borough: "Havering", region: "London", lat: 51.5775, lng: 0.1786 },
  { slug: "stratford", name: "Stratford", borough: "Newham", region: "London", lat: 51.5426, lng: -0.001 },
  { slug: "canary-wharf", name: "Canary Wharf", borough: "Tower Hamlets", region: "London", lat: 51.5056, lng: -0.0264 },
  { slug: "wimbledon", name: "Wimbledon", borough: "Merton", region: "London", lat: 51.4183, lng: -0.2206 },
  { slug: "harrow", name: "Harrow", borough: "Harrow", region: "London", lat: 51.5805, lng: -0.3421 },
  { slug: "kingston", name: "Kingston upon Thames", shortName: "Kingston", borough: "Kingston upon Thames", region: "London", lat: 51.4123, lng: -0.3007 },
  { slug: "enfield", name: "Enfield", borough: "Enfield", region: "London", lat: 51.6523, lng: -0.0807 },
  { slug: "bromley", name: "Bromley", borough: "Bromley", region: "London", lat: 51.4063, lng: 0.0187 },
  { slug: "hounslow", name: "Hounslow", borough: "Hounslow", region: "London", lat: 51.4704, lng: -0.3632 },
];

export const getArea = (slug: string) => areas.find((a) => a.slug === slug);

/** Trafalgar Square, the usual centre point for "central London". */
export const centralLondon: Area = { slug: "central-london", name: "central London", borough: "Westminster", region: "London", lat: 51.508, lng: -0.1281 };

/** Airports nearest first, by straight-line distance. */
export function airportsByDistance(area: Area): AirportCode[] {
  return [...airports].sort((a, b) => haversineMiles(area, a) - haversineMiles(area, b)).map((a) => a.code);
}

/** The other areas with a page, nearest first. */
export function nearbyAreas(area: Area, count: number): Area[] {
  return areas
    .filter((a) => a.slug !== area.slug)
    .sort((a, b) => haversineMiles(area, a) - haversineMiles(area, b))
    .slice(0, count);
}

/**
 * Example journeys for the local rides page: routes priced on the reference
 * website on 2026-10-21, between the points named.
 */
export const exampleLocalRoutes: { from: NamedPoint; to: NamedPoint }[] = [
  { from: { name: "Whitechapel", region: "London", lat: 51.51787, lng: -0.06705 }, to: { name: "Westminster", region: "London", lat: 51.501, lng: -0.1416 } },
  { from: { name: "Whitechapel", region: "London", lat: 51.51787, lng: -0.06705 }, to: { name: "Canary Wharf", region: "London", lat: 51.5049, lng: -0.0195 } },
  { from: { name: "Ealing", region: "London", lat: 51.51498, lng: -0.3015 }, to: { name: "Wembley", region: "London", lat: 51.5567, lng: -0.2797 } },
  { from: { name: "Croydon", region: "London", lat: 51.37495, lng: -0.093 }, to: { name: "Wimbledon", region: "London", lat: 51.4169, lng: -0.2133 } },
  { from: { name: "Romford", region: "London", lat: 51.57598, lng: 0.18012 }, to: { name: "Stratford", region: "London", lat: 51.5443, lng: -0.0063 } },
  { from: { name: "Westminster", region: "London", lat: 51.501, lng: -0.1416 }, to: { name: "Croydon", region: "London", lat: 51.37495, lng: -0.093 } },
  { from: { name: "Croydon", region: "London", lat: 51.37495, lng: -0.093 }, to: { name: "Guildford", region: "South East", lat: 51.2347, lng: -0.573 } },
  { from: { name: "Westminster", region: "London", lat: 51.501, lng: -0.1416 }, to: { name: "Reading", region: "South East", lat: 51.4573, lng: -0.9719 } },
  { from: { name: "Whitechapel", region: "London", lat: 51.51787, lng: -0.06705 }, to: { name: "Cambridge", region: "East of England", lat: 52.2051, lng: 0.1162 } },
  { from: { name: "Westminster", region: "London", lat: 51.501, lng: -0.1416 }, to: { name: "Oxford", region: "South East", lat: 51.7502, lng: -1.2674 } },
  { from: { name: "Whitechapel", region: "London", lat: 51.51787, lng: -0.06705 }, to: { name: "Brighton", region: "South East", lat: 50.8263, lng: -0.1408 } },
  { from: { name: "Whitechapel", region: "London", lat: 51.51787, lng: -0.06705 }, to: { name: "Birmingham", region: "West Midlands", lat: 52.4777, lng: -1.898 } },
];
