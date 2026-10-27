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
  /** A few lines about the place: well-known facts only (stations, landmarks), nothing about the business. */
  about: string;
}

/**
 * Areas with their own page. Centre points as Google Maps gives them for the
 * area name (2026-10-21). Only facts that follow from the point are stated.
 */
export const areas: Area[] = [
  { slug: "croydon", name: "Croydon", borough: "Croydon", region: "London", lat: 51.377, lng: -0.0957, about: "Croydon is one of the largest town centres in south London, built around East Croydon and West Croydon stations and the Tramlink tram network." },
  { slug: "wembley", name: "Wembley", borough: "Brent", region: "London", lat: 51.556, lng: -0.2796, about: "Wembley, in the London Borough of Brent, is home to Wembley Stadium and OVO Arena Wembley. On stadium event days the roads around Wembley Park get very busy, so allow extra time for your pickup." },
  { slug: "ealing", name: "Ealing", borough: "Ealing", region: "London", lat: 51.5133, lng: -0.3043, about: "Ealing is in west London, centred on Ealing Broadway station, which is served by the Elizabeth line and the Central and District lines. Heathrow is only a short drive away." },
  { slug: "romford", name: "Romford", borough: "Havering", region: "London", lat: 51.5775, lng: 0.1786, about: "Romford is the main town in the London Borough of Havering, on London's eastern edge near the Essex border. Romford station is on the Elizabeth line." },
  { slug: "stratford", name: "Stratford", borough: "Newham", region: "London", lat: 51.5426, lng: -0.001, about: "Stratford in east London is home to Westfield Stratford City and the Queen Elizabeth Olympic Park, and Stratford station is one of London's busiest interchanges. London City Airport is a short drive away." },
  { slug: "canary-wharf", name: "Canary Wharf", borough: "Tower Hamlets", region: "London", lat: 51.5056, lng: -0.0264, about: "Canary Wharf is a business district on the Isle of Dogs in east London. London City Airport is only a few miles to the east, which makes it a quick transfer for business trips." },
  { slug: "wimbledon", name: "Wimbledon", borough: "Merton", region: "London", lat: 51.4183, lng: -0.2206, about: "Wimbledon in south-west London is best known for the tennis championships held there every summer. During the tournament the roads near the All England Club are busy, so allow extra time." },
  { slug: "harrow", name: "Harrow", borough: "Harrow", region: "London", lat: 51.5805, lng: -0.3421, about: "Harrow is in north-west London, around Harrow-on-the-Hill station and the town centre. Heathrow is the nearest airport." },
  { slug: "kingston", name: "Kingston upon Thames", shortName: "Kingston", borough: "Kingston upon Thames", region: "London", lat: 51.4123, lng: -0.3007, about: "Kingston upon Thames is a riverside town in south-west London, with its station and shopping streets close to the Thames. Heathrow is the nearest airport." },
  { slug: "enfield", name: "Enfield", borough: "Enfield", region: "London", lat: 51.6523, lng: -0.0807, about: "Enfield sits on London's northern edge, around Enfield Town and its station. London City, Luton and Stansted are all within reach." },
  { slug: "bromley", name: "Bromley", borough: "Bromley", region: "London", lat: 51.4063, lng: 0.0187, about: "Bromley is in south-east London, around Bromley South station and the town's high street. London City and Gatwick are the nearest airports." },
  { slug: "hounslow", name: "Hounslow", borough: "Hounslow", region: "London", lat: 51.4704, lng: -0.3632, about: "Hounslow in west London lies right next to Heathrow, so a transfer from here is one of the shortest airport journeys in London." },
];

export const getArea = (slug: string) => areas.find((a) => a.slug === slug);

/** Trafalgar Square, the usual centre point for "central London". */
export const centralLondon: Area = { slug: "central-london", name: "central London", borough: "Westminster", region: "London", lat: 51.508, lng: -0.1281, about: "" };

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
