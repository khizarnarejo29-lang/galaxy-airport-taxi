/**
 * Example fixed prices for the airport pages: what the calculator charges from a
 * few well-known London postcodes, worked out from the live tariff, so they can
 * never disagree with a real quote for that postcode.
 */
import { activeTariff, type PricingConfig } from "@/config/pricing";
import { getAirport } from "@/lib/domain/airports";
import type { AirportCode, JourneyEnd, PricedJourney, VehicleId } from "@/lib/domain/types";
import { haversineMiles } from "@/lib/domain/geo";
import type { Pence } from "@/lib/utils/money";
import { tariffPrice } from "./tariff-pricing";

/** Postcode centres, as postcodes.io gives them. */
export const exampleAreas = [
  { area: "Central London", postcode: "SW1A 1AA", lat: 51.501, lng: -0.1416 },
  { area: "East London", postcode: "E1 5NF", lat: 51.5176, lng: -0.0663 },
  { area: "West London", postcode: "W5 2NU", lat: 51.5149, lng: -0.3017 },
  { area: "North-west London", postcode: "HA9 0WS", lat: 51.556, lng: -0.2795 },
  { area: "South London", postcode: "CR0 1LF", lat: 51.3754, lng: -0.092 },
  { area: "East London (outer)", postcode: "RM1 1AU", lat: 51.5752, lng: 0.1826 },
] as const;

export const exampleVehicles: VehicleId[] = ["saloon", "estate", "executive", "mpv", "minibus"];

export interface ExampleFare {
  area: string;
  postcode: string;
  /** One-way price per vehicle, at the airport's cheapest terminal. */
  prices: Partial<Record<VehicleId, Pence>>;
}

/** Same estimate the quote uses (see services/distance.ts). */
const ROAD_FACTOR = 1.3;

function oneWayTo(airport: AirportCode, area: (typeof exampleAreas)[number], terminal: string | undefined, vehicleId: VehicleId, tariff: PricingConfig) {
  const at = getAirport(airport)!;
  const address: JourneyEnd = { kind: "address", address: { id: `pc:${area.postcode}`, kind: "postcode", label: area.postcode, postcode: area.postcode, lat: area.lat, lng: area.lng } };
  const journey: PricedJourney = {
    pickup: address,
    dropoff: { kind: "airport", airport, ...(terminal ? { terminal } : {}) },
    extraStops: [],
    // An ordinary weekday, away from Christmas and New Year rates.
    date: "2026-03-10",
    time: "12:00",
    pickupAtUtc: "2026-03-10T12:00:00Z",
    passengers: 1,
    luggage: { large: 0, small: 0 },
    distanceMiles: Math.round(haversineMiles(area, at) * ROAD_FACTOR * 10) / 10,
    tripType: "one_way",
    largeItems: false,
    extras: { meetAndGreet: false, childSeats: 0 },
  };
  const priced = tariffPrice(journey, vehicleId, journey.extras, tariff);
  return priced.pricing.status === "tariff" ? priced.total : null;
}

/** Example one-way prices to (or from) an airport, or an empty list when no tariff is in use. */
export function exampleFares(airport: AirportCode, tariff: PricingConfig | null = activeTariff()): ExampleFare[] {
  if (!tariff) return [];
  const terminals = getAirport(airport)!.terminals.map((t) => t.id);
  return exampleAreas.map((area) => {
    const prices: ExampleFare["prices"] = {};
    for (const v of exampleVehicles) {
      const all = (terminals.length ? terminals : [undefined])
        .map((t) => oneWayTo(airport, area, t, v, tariff))
        .filter((p): p is Pence => p !== null);
      if (all.length) prices[v] = Math.min(...all);
    }
    return { area: area.area, postcode: area.postcode, prices };
  });
}

/** The lowest saloon price from central London, for the airport cards. */
export function centralLondonFrom(airport: AirportCode, tariff: PricingConfig | null = activeTariff()): Pence | null {
  return exampleFares(airport, tariff)[0]?.prices.saloon ?? null;
}
