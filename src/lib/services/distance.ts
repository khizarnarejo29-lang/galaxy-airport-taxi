import { haversineMiles } from "@/lib/domain/geo";
import type { LatLng } from "@/lib/domain/types";

export interface DistanceProvider {
  /** Driving distance in miles along the given points, in order. */
  routeMiles(points: LatLng[]): Promise<number>;
}

/**
 * Straight-line distance × a typical road factor for London.
 * Used when no routing service is switched on, and as its fallback.
 */
export function estimatedDistance(roadFactor = 1.3): DistanceProvider {
  return {
    async routeMiles(points) {
      let miles = 0;
      for (let i = 1; i < points.length; i++) miles += haversineMiles(points[i - 1], points[i]);
      return Math.round(miles * roadFactor * 10) / 10;
    },
  };
}

const METRES_PER_MILE = 1609.344;
const CACHE_SIZE = 500;

/**
 * Real driving distance from Google Routes (no live traffic, so the same trip
 * always measures the same). Results are kept in memory, since a customer
 * re-quotes the same route several times. Falls back to the estimate if
 * Google can't be reached, so a quote is never blocked by it.
 */
export function googleRoutesDistance(
  apiKey: string,
  { fallback = estimatedDistance(), fetchImpl = fetch }: { fallback?: DistanceProvider; fetchImpl?: typeof fetch } = {},
): DistanceProvider {
  const cache = new Map<string, number>();
  const point = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

  return {
    async routeMiles(points) {
      if (points.length < 2) return 0;
      const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      try {
        const res = await fetchImpl("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "routes.distanceMeters" },
          body: JSON.stringify({
            origin: point(points[0]),
            destination: point(points[points.length - 1]),
            intermediates: points.slice(1, -1).map(point),
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
            regionCode: "gb",
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`Google Routes responded ${res.status}`);
        const metres = ((await res.json()) as { routes?: { distanceMeters?: number }[] }).routes?.[0]?.distanceMeters;
        if (typeof metres !== "number") throw new Error("Google Routes found no route");
        const miles = Math.round((metres / METRES_PER_MILE) * 10) / 10;
        if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
        cache.set(key, miles);
        return miles;
      } catch (err) {
        console.error("[distance] Google Routes failed, using the estimate", err);
        return fallback.routeMiles(points);
      }
    },
  };
}
