import { bookingRules } from "@/config/booking-rules";
import { site } from "@/config/site";
import { getAirport } from "@/lib/domain/airports";
import type { VehicleId } from "@/lib/domain/types";
import { exampleVehicles } from "@/lib/pricing/example-fares";
import { airportFareFrom, localFare, type NamedPoint } from "@/lib/pricing/route-fares";
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
  return [
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
      a: `Enter your pickup and drop-off in the calculator to see a fixed price for each vehicle and book online, with at least ${bookingRules.minNoticeMinutes / 60} hours' notice. For sooner journeys, call or WhatsApp us on ${site.phone.display}.`,
    },
    ...(policies.waitingTime ? [{ q: "How long will the driver wait?", a: policies.waitingTime }] : []),
  ];
}
