/**
 * Checks the location tariff against the recorded reference fares, so the owner
 * can set tariff figures that stay at least £2 under the reference website:
 * for each fare, what the tariff would charge for the same journey and vehicle,
 * and whether that is above the reference total minus £2.
 */
import type { PricingConfig } from "@/config/pricing";
import { referenceFareRules, vehicleMapping } from "@/config/reference-vehicles";
import { getAirport } from "@/lib/domain/airports";
import type { JourneyEnd, LatLng, PricedAddress, PricedJourney, VehicleId } from "@/lib/domain/types";
import type { ReferenceFare } from "@/lib/reference-fares/schema";
import type { DistanceProvider } from "@/lib/services/distance";
import type { Pence } from "@/lib/utils/money";
import { tariffPrice } from "./tariff-pricing";

export interface TariffCheckRow {
  id: string;
  status: ReferenceFare["status"];
  vehicleId: VehicleId | null;
  referenceTotal: Pence;
  /** The most the tariff may charge: reference total minus £2. */
  ceiling: Pence;
  tariffTotal: Pence | null;
  /** "ok": at or under the ceiling; "too_high": above it; "not_checked": see note. */
  verdict: "ok" | "too_high" | "not_checked";
  note?: string;
}

/** Looks up a postcode's coordinates (postcodes.io on the owner's machine; a stub in tests). */
export type PostcodeLookup = (postcode: string) => Promise<LatLng | null>;

const galaxyVehicleFor = (fare: ReferenceFare): VehicleId | null =>
  (Object.entries(vehicleMapping).find(([, ref]) => ref === fare.referenceVehicle)?.[0] as VehicleId | undefined) ?? null;

export async function checkTariffAgainstFares(
  fares: readonly ReferenceFare[],
  tariff: PricingConfig,
  lookup: PostcodeLookup,
  distance: DistanceProvider,
): Promise<TariffCheckRow[]> {
  const rows: TariffCheckRow[] = [];
  for (const fare of fares) {
    const ceiling = fare.referenceTotalPence - referenceFareRules.discountPence;
    const base = { id: fare.id, status: fare.status, referenceTotal: fare.referenceTotalPence, ceiling };
    const vehicleId = galaxyVehicleFor(fare);
    const skip = (note: string) => rows.push({ ...base, vehicleId, tariffTotal: null, verdict: "not_checked", note });
    if (!vehicleId) {
      skip("No Galaxy vehicle for this reference vehicle");
      continue;
    }

    // Each address end needs coordinates; a missing postcode means it can't be measured.
    const missing: string[] = [];
    const point = async (postcode: string): Promise<PricedAddress | null> => {
      const at = await lookup(postcode);
      if (!at) missing.push(postcode);
      return at && { id: `pc:${postcode}`, kind: "postcode", label: postcode, postcode, lat: at.lat, lng: at.lng };
    };
    const endOf = async (e: ReferenceFare["pickup"]): Promise<JourneyEnd | null> => {
      if (e.kind === "airport") return { kind: "airport", airport: e.airport, ...(e.terminal ? { terminal: e.terminal } : {}) };
      const address = await point(e.postcode);
      return address && { kind: "address", address: { ...address, line1: e.line1 } };
    };
    const coords = (e: JourneyEnd): LatLng => (e.kind === "address" ? e.address : getAirport(e.airport)!);

    const pickup = await endOf(fare.pickup);
    const dropoff = await endOf(fare.dropoff);
    const stops = (await Promise.all(fare.stops.map(point))).filter((s): s is PricedAddress => s !== null);
    const leg = fare.returnLeg?.status === "confirmed" ? fare.returnLeg : null;
    const returnPickup = leg ? await endOf(leg.pickup) : null;
    const returnStops = leg ? (await Promise.all(leg.stops.map(point))).filter((s): s is PricedAddress => s !== null) : [];
    if (missing.length || !pickup || !dropoff || (fare.tripType === "return" && !returnPickup)) {
      skip(missing.length ? `Postcode not found: ${missing.join(", ")}` : "Return route not confirmed");
      continue;
    }

    const dates = fare.verifiedTravelDates[0];
    const journey: PricedJourney = {
      pickup,
      dropoff,
      tripType: fare.tripType,
      extraStops: stops,
      date: dates.outbound,
      time: "12:00",
      pickupAtUtc: `${dates.outbound}T12:00:00Z`,
      passengers: Math.max(...fare.confirmedParties.map((p) => p.passengers)),
      luggage: { large: 0, small: 0 },
      distanceMiles: await distance.routeMiles([coords(pickup), ...stops, coords(dropoff)]),
      largeItems: false,
      extras: fare.extras,
      returnJourney:
        leg && returnPickup
          ? {
              pickup: returnPickup,
              extraStops: returnStops,
              date: dates.return ?? dates.outbound,
              time: "12:00",
              pickupAtUtc: `${dates.return ?? dates.outbound}T12:00:00Z`,
              distanceMiles: await distance.routeMiles([coords(returnPickup), ...returnStops, coords(pickup)]),
            }
          : undefined,
    };

    const priced = tariffPrice(journey, vehicleId, fare.extras, tariff);
    if (priced.pricing.status !== "tariff") {
      skip(`The tariff can't price this journey (${priced.pricing.status === "price_on_request" ? priced.pricing.reason : "?"})`);
      continue;
    }
    rows.push({ ...base, vehicleId, tariffTotal: priced.total, verdict: priced.total > ceiling ? "too_high" : "ok" });
  }
  return rows;
}
