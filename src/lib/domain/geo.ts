import type { ServiceAreaConfig } from "@/config/service-area";
import type { LatLng, ResolvedLocation } from "./types";

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?) ?(\d[A-Z]{2})$/;

/** Uppercase, single-spaced UK postcode, or null if it isn't one. */
export function normalisePostcode(value: string): string | null {
  const m = UK_POSTCODE.exec(value.trim().toUpperCase().replace(/\s+/g, " "));
  return m ? `${m[1]} ${m[2]}` : null;
}

export function postcodeArea(outcode: string): string {
  return outcode.match(/^[A-Z]+/)?.[0] ?? "";
}

export function isInServiceArea(loc: ResolvedLocation, area: ServiceAreaConfig): boolean {
  const outcode = loc.outcode?.toUpperCase();
  if (outcode && area.excludedPostcodeDistricts.includes(outcode)) return false;

  if (loc.region && area.regions.includes(loc.region)) return true;
  if (outcode && area.extraPostcodeDistricts.includes(outcode)) return true;
  if (outcode && area.extraPostcodeAreas.includes(postcodeArea(outcode))) return true;
  if (area.radius && haversineMiles(loc, area.radius.centre) <= area.radius.miles) return true;
  return false;
}
