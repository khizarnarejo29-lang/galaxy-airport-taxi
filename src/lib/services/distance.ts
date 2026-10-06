import { haversineMiles } from "@/lib/domain/geo";
import type { LatLng } from "@/lib/domain/types";

export interface DistanceProvider {
  /** Driving distance in miles along the given points, in order. */
  routeMiles(points: LatLng[]): Promise<number>;
}

/**
 * Straight-line distance × a typical road factor for London.
 * Replace with a routing API (e.g. Google Routes) for road distances.
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
