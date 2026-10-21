/**
 * Example fixed prices between named points (area centres, city centres), worked
 * out from the live tariff the same way a quote is, so the pages can show real
 * prices for journeys the customer may not have priced yet.
 */
import { activeTariff, type PricingConfig } from "@/config/pricing";
import { getAirport } from "@/lib/domain/airports";
import { haversineMiles } from "@/lib/domain/geo";
import type { AirportCode, JourneyEnd, LatLng, PricedJourney, VehicleId } from "@/lib/domain/types";
import type { Pence } from "@/lib/utils/money";
import { tariffPrice } from "./tariff-pricing";

export interface NamedPoint extends LatLng {
  name: string;
  /** "London" for Greater London; anything else prices as outside London. */
  region: string;
}

/** Same estimate the quote uses when no routing service is on (see services/distance.ts). */
const ROAD_FACTOR = 1.3;
const miles = (a: LatLng, b: LatLng) => Math.round(haversineMiles(a, b) * ROAD_FACTOR * 10) / 10;

const address = (p: NamedPoint): JourneyEnd => ({
  kind: "address",
  address: { id: `ex:${p.name}`, kind: "place", label: p.name, region: p.region, lat: p.lat, lng: p.lng },
});

function oneWay(pickup: JourneyEnd, dropoff: JourneyEnd, distanceMiles: number, vehicleId: VehicleId, tariff: PricingConfig): Pence | null {
  const journey: PricedJourney = {
    pickup,
    dropoff,
    extraStops: [],
    // An ordinary weekday, away from Christmas and New Year rates.
    date: "2026-03-10",
    time: "12:00",
    pickupAtUtc: "2026-03-10T12:00:00Z",
    passengers: 1,
    luggage: { large: 0, small: 0 },
    distanceMiles,
    tripType: "one_way",
    largeItems: false,
    extras: { meetAndGreet: false, childSeats: 0 },
  };
  const priced = tariffPrice(journey, vehicleId, journey.extras, tariff);
  return priced.pricing.status === "tariff" ? priced.total : null;
}

/** One way between two places, or null when there is no tariff for it. */
export function localFare(from: NamedPoint, to: NamedPoint, vehicleId: VehicleId, tariff: PricingConfig | null = activeTariff()): Pence | null {
  return tariff ? oneWay(address(from), address(to), miles(from, to), vehicleId, tariff) : null;
}

/** One way from a place to an airport, at its lowest-priced terminal, or null without a tariff. */
export function airportFareFrom(from: NamedPoint, airport: AirportCode, vehicleId: VehicleId, tariff: PricingConfig | null = activeTariff()): Pence | null {
  if (!tariff) return null;
  const at = getAirport(airport)!;
  const prices = (at.terminals.length ? at.terminals.map((t) => t.id) : [undefined])
    .map((terminal) => oneWay(address(from), { kind: "airport", airport, ...(terminal ? { terminal } : {}) }, miles(from, at), vehicleId, tariff))
    .filter((p): p is Pence => p !== null);
  return prices.length ? Math.min(...prices) : null;
}
