import { bookingRules } from "@/config/booking-rules";
import { callOrWhatsApp } from "@/config/site";
import { activeTariff } from "@/config/pricing";
import { airports, getAirport } from "@/lib/domain/airports";
import type { AirportCode, VehicleId } from "@/lib/domain/types";
import { betweenAirportsFare } from "@/lib/pricing/engine";
import { exampleVehicles } from "@/lib/pricing/example-fares";
import { airportFareFrom, localFare, type NamedPoint } from "@/lib/pricing/route-fares";
import { haversineMiles } from "@/lib/domain/geo";
import { formatGBP, type Pence } from "@/lib/utils/money";
import type { Faq } from "./airports";
import { airportsByDistance, centralLondon, exampleLocalRoutes, nearbyAreas, type Area } from "./areas";
import { policies } from "./policies";

type Prices = Partial<Record<VehicleId, Pence>>;

const pricesFor = (fare: (v: VehicleId) => Pence | null): Prices =>
  Object.fromEntries(exampleVehicles.flatMap((v) => {
    const p = fare(v);
    return p === null ? [] : [[v, p]];
  }));

/** One way from the area to each airport, nearest first. */
export function airportRows(area: Area) {
  return airportsByDistance(area).map((code) => {
    const airport = getAirport(code)!;
    return { label: airport.name, sub: code, prices: pricesFor((v) => airportFareFrom(area, code, v)) };
  });
}

/** One way from an airport to each of the others, from the listed fares between airports. */
export function otherAirportRows(from: AirportCode) {
  const tariff = activeTariff();
  if (!tariff) return [];
  return airports
    .filter((a) => a.code !== from)
    .map((a) => ({ label: a.name, sub: a.code, prices: pricesFor((v) => betweenAirportsFare({ from, to: a.code, vehicleId: v }, tariff)) }))
    .filter((r) => Object.keys(r.prices).length > 0);
}

/** One way from the area to central London and the nearest areas with a page. */
export function localRows(area: Area) {
  return [centralLondon, ...nearbyAreas(area, 3)].map((to) => ({
    label: to === centralLondon ? "Central London" : to.name,
    sub: to === centralLondon ? "Trafalgar Square" : `London Borough of ${to.borough}`,
    prices: pricesFor((v) => localFare(area, to, v)),
  }));
}

/** The example journeys on the local rides page. */
export function exampleRouteRows() {
  return exampleLocalRoutes.map(({ from, to }: { from: NamedPoint; to: NamedPoint }) => ({
    label: `${from.name} to ${to.name}`,
    prices: pricesFor((v) => localFare(from, to, v)),
  }));
}

/** Questions for an area page, answered from the live tariff. */
export function areaFaqs(area: Area): Faq[] {
  const [nearest] = airportsByDistance(area);
  const airport = getAirport(nearest)!;
  const toAirport = airportFareFrom(area, nearest, "saloon");
  const toCentre = localFare(area, centralLondon, "saloon");
  const miles = Math.round(haversineMiles(area, airport));
  return [
    {
      q: `Which airport is closest to ${area.name}?`,
      a: `${airport.name} is the closest, about ${miles} miles away in a straight line. The table on this page shows the price from ${area.name} to all five London airports, nearest first.`,
    },
    ...(toAirport !== null
      ? [
          {
            q: `How much is a taxi from ${area.name} to ${airport.shortName} Airport?`,
            a: `From ${formatGBP(toAirport)} one way in a saloon (up to 4 passengers), a fixed price for the whole car with airport charges included. The table on this page shows every vehicle and the other airports.`,
          },
        ]
      : []),
    ...(toCentre !== null
      ? [
          {
            q: `How much is a taxi from ${area.name} to central London?`,
            a: `From ${formatGBP(toCentre)} one way in a saloon. Your exact price depends on the addresses: enter them in the calculator above.`,
          },
        ]
      : []),
    {
      q: `Do you do local rides in ${area.name}, not just airport transfers?`,
      a: `Yes. We take you anywhere in ${area.name} and beyond: hospital appointments, train stations, the office, shopping or an evening out, at a fixed price agreed before you book.`,
    },
    {
      q: "How do I book?",
      a: `Enter your pickup and drop-off in the calculator to see a fixed price for each vehicle and book online, with at least ${bookingRules.minNoticeMinutes / 60} hours' notice. For sooner journeys, ${callOrWhatsApp()}.`,
    },
    ...(policies.waitingTime ? [{ q: "How long will the driver wait?", a: policies.waitingTime }] : []),
  ];
}
