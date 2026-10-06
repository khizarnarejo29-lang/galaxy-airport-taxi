/**
 * Location lookup via postcodes.io — free, open data, no API key.
 * Resolves postcodes and named places to coordinates and region; it does not
 * return street addresses, so the customer types their house number and street.
 */
import { normalisePostcode } from "@/lib/domain/geo";
import type { ResolvedLocation } from "@/lib/domain/types";
import { LocationLookupError, type LocationProvider } from "./types";

const BASE = "https://api.postcodes.io";
const TIMEOUT_MS = 5000;
const MAX_RESULTS = 8;

interface PostcodeResult {
  postcode: string;
  outcode: string;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
  admin_district: string | null;
}

interface PlaceResult {
  code: string;
  name_1: string;
  local_type: string;
  outcode: string | null;
  region: string | null;
  district_borough: string | null;
  county_unitary: string | null;
  latitude: number;
  longitude: number;
}

/** Settlement-like place types; excludes e.g. roads and water features. */
const PLACE_TYPES = new Set(["City", "Town", "Village", "Hamlet", "Suburban Area", "Other Settlement"]);

async function get<T>(path: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch (cause) {
    throw new LocationLookupError("postcodes.io unreachable", { cause });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new LocationLookupError(`postcodes.io responded ${res.status}`);
  const body = (await res.json()) as { result: T | null };
  return body.result;
}

function fromPostcode(p: PostcodeResult): ResolvedLocation | null {
  if (p.latitude === null || p.longitude === null) return null;
  return {
    id: `pc:${p.postcode}`,
    kind: "postcode",
    label: [p.postcode, p.admin_district].filter(Boolean).join(", "),
    postcode: p.postcode,
    outcode: p.outcode,
    district: p.admin_district ?? undefined,
    region: p.region ?? undefined,
    lat: p.latitude,
    lng: p.longitude,
  };
}

function fromPlace(p: PlaceResult): ResolvedLocation {
  const area = p.district_borough ?? p.county_unitary;
  return {
    id: `pl:${p.code}`,
    kind: "place",
    label: [p.name_1, area && area !== p.name_1 ? area : null].filter(Boolean).join(", "),
    outcode: p.outcode ?? undefined,
    district: area ?? undefined,
    region: p.region ?? undefined,
    lat: p.latitude,
    lng: p.longitude,
  };
}

const looksLikePostcode = (q: string) => /^[A-Z]{1,2}\d/i.test(q.trim());

export const postcodesIo: LocationProvider = {
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];

    if (looksLikePostcode(q)) {
      const exact = normalisePostcode(q);
      if (exact) {
        const hit = await get<PostcodeResult>(`/postcodes/${encodeURIComponent(exact)}`);
        const loc = hit && fromPostcode(hit);
        if (loc) return [loc];
      }
      const suggestions =
        (await get<string[]>(`/postcodes/${encodeURIComponent(q)}/autocomplete?limit=${MAX_RESULTS}`)) ?? [];
      const results = await Promise.all(suggestions.map((pc) => this.lookupPostcode(pc)));
      return results.filter((r): r is ResolvedLocation => r !== null);
    }

    const places = (await get<PlaceResult[]>(`/places?q=${encodeURIComponent(q)}&limit=25`)) ?? [];
    return places
      .filter((p) => PLACE_TYPES.has(p.local_type))
      .slice(0, MAX_RESULTS)
      .map(fromPlace);
  },

  async resolve(id) {
    const [kind, value] = [id.slice(0, 3), id.slice(3)];
    if (kind === "pc:") return this.lookupPostcode(value);
    if (kind === "pl:") {
      const place = await get<PlaceResult>(`/places/${encodeURIComponent(value)}`);
      return place ? fromPlace(place) : null;
    }
    return null;
  },

  async lookupPostcode(postcode) {
    const normalised = normalisePostcode(postcode);
    if (!normalised) return null;
    const hit = await get<PostcodeResult>(`/postcodes/${encodeURIComponent(normalised)}`);
    return hit ? fromPostcode(hit) : null;
  },
};
