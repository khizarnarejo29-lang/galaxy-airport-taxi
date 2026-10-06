import { pricing } from "@/config/pricing";
import type { AddOns, VehicleId } from "@/lib/domain/types";
import { price, type PriceResult } from "@/lib/pricing/engine";
import type { QuoteState } from "./state";

/** Live total for the chosen vehicle and add-ons — the same engine the server uses. */
export function priceWithAddOns(q: QuoteState, vehicleId: VehicleId, addOns: AddOns): PriceResult {
  const j = q.quote.journey;
  return price(
    {
      direction: j.direction,
      airport: j.airport,
      vehicleId,
      distanceMiles: j.distanceMiles,
      time: j.time,
      extraStops: j.extraStops.length,
      addOns,
    },
    pricing,
  );
}
