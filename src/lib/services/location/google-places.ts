/**
 * Address search via Google Places (New): full street addresses, hotels,
 * stations and other named places, as on the reference website. Server-side
 * only, so the API key never reaches the browser.
 *
 * Google gives the exact point and postcode; postcodes.io still supplies the
 * region and district, so pricing (e.g. outside London) works as before.
 * If Google can't be reached, search falls back to postcodes.io.
 */
import { normalisePostcode } from "@/lib/domain/geo";
import type { LocationSearchResult, ResolvedLocation } from "@/lib/domain/types";
import { postcodesIo } from "./postcodes-io";
import { LocationLookupError, type LocationProvider } from "./types";

const BASE = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 5000;
const MAX_RESULTS = 8;
const ID_PREFIX = "gp:";
/** Google place ids are URL-safe; anything else is refused before it reaches the API. */
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const SESSION = /^[A-Za-z0-9-]{8,64}$/;

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

interface PlaceDetails {
  id: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: AddressComponent[];
  displayName?: { text: string };
  types?: string[];
}

interface AutocompleteResponse {
  suggestions?: { placePrediction?: { placeId: string; text?: { text: string } } }[];
}

/** Region, district and postcode area for a point, as postcodes.io gives them. */
export type AreaLookup = (place: { postcode?: string; lat: number; lng: number }) => Promise<
  Pick<ResolvedLocation, "region" | "district" | "outcode"> | null
>;

const reverseLookupBase = "https://api.postcodes.io/postcodes";

/** The postcode's own area if it has a full postcode, otherwise the nearest postcode's. */
export const postcodesIoArea: AreaLookup = async ({ postcode, lat, lng }) => {
  if (postcode) {
    const hit = await postcodesIo.lookupPostcode(postcode);
    if (hit) return { region: hit.region, district: hit.district, outcode: hit.outcode };
  }
  let res: Response;
  try {
    res = await fetch(`${reverseLookupBase}?lon=${lng}&lat=${lat}&limit=1&radius=2000`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch (cause) {
    throw new LocationLookupError("postcodes.io unreachable", { cause });
  }
  if (!res.ok) throw new LocationLookupError(`postcodes.io responded ${res.status}`);
  const body = (await res.json()) as {
    result: { region: string | null; country: string | null; admin_district: string | null; outcode: string }[] | null;
  };
  const near = body.result?.[0];
  return near ? { region: near.region ?? near.country ?? undefined, district: near.admin_district ?? undefined, outcode: near.outcode } : null;
};

const component = (place: PlaceDetails, type: string) => place.addressComponents?.find((c) => c.types.includes(type));

/** House number and street, or the building's name for a hotel, station or other named place. */
function firstLine(place: PlaceDetails): string | undefined {
  const number = component(place, "street_number")?.longText;
  const street = component(place, "route")?.longText;
  const premise = component(place, "premise")?.longText ?? component(place, "subpremise")?.longText;
  const streetLine = [number, street].filter(Boolean).join(" ");
  const named = place.types?.some((t) => t === "establishment" || t === "point_of_interest" || t === "lodging");
  const name = named ? place.displayName?.text : premise;
  return [name, streetLine].filter(Boolean).join(", ") || undefined;
}

/** A Google place as a priced location, or null if it isn't a usable UK point. */
export function toLocation(place: PlaceDetails, area: Awaited<ReturnType<AreaLookup>>): ResolvedLocation | null {
  if (!place.location || component(place, "country")?.shortText !== "GB") return null;
  // Only a full postcode is kept: fares are matched on it, so a partial one must never stand in.
  const postcode = normalisePostcode(component(place, "postal_code")?.longText ?? "") ?? undefined;
  return {
    id: `${ID_PREFIX}${place.id}`,
    kind: "address",
    label: (place.formattedAddress ?? place.displayName?.text ?? "").replace(/, UK$/, ""),
    line1: firstLine(place),
    postcode,
    outcode: area?.outcode ?? postcode?.split(" ")[0],
    district: area?.district ?? component(place, "postal_town")?.longText,
    // Pricing treats an address without a region as London, so an unknown one is marked as outside it.
    region: area?.region ?? (component(place, "postal_town")?.longText === "London" ? "London" : "Unknown"),
    lat: place.location.latitude,
    lng: place.location.longitude,
  };
}

export function googlePlaces(
  apiKey: string,
  { fallback = postcodesIo, area = postcodesIoArea, fetchImpl = fetch }: { fallback?: LocationProvider; area?: AreaLookup; fetchImpl?: typeof fetch } = {},
): LocationProvider {
  async function call<T>(url: string, init: RequestInit & { next?: { revalidate: number } }): Promise<T | null> {
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (cause) {
      throw new LocationLookupError("Google Places unreachable", { cause });
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new LocationLookupError(`Google Places responded ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    async search(query, session) {
      const q = query.trim();
      if (q.length < 3) return fallback.search(q);
      try {
        const body = await call<AutocompleteResponse>(`${BASE}/places:autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
          body: JSON.stringify({
            input: q,
            includedRegionCodes: ["gb"],
            regionCode: "gb",
            languageCode: "en-GB",
            ...(session && SESSION.test(session) ? { sessionToken: session } : {}),
          }),
        });
        const results: LocationSearchResult[] = (body?.suggestions ?? [])
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId && PLACE_ID.test(p.placeId)))
          .slice(0, MAX_RESULTS)
          .map((p) => ({ id: `${ID_PREFIX}${p.placeId}`, kind: "suggestion", label: (p.text?.text ?? "").replace(/, UK$/, "") }));
        return results;
      } catch (err) {
        if (!(err instanceof LocationLookupError)) throw err;
        console.error("[locations] Google search failed, using postcodes.io", err);
        return fallback.search(q);
      }
    },

    async resolve(id, session) {
      if (!id.startsWith(ID_PREFIX)) return fallback.resolve(id);
      const placeId = id.slice(ID_PREFIX.length);
      if (!PLACE_ID.test(placeId)) return null;
      const params = new URLSearchParams({ languageCode: "en-GB", regionCode: "gb" });
      if (session && SESSION.test(session)) params.set("sessionToken", session);
      const place = await call<PlaceDetails>(`${BASE}/places/${placeId}?${params}`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents,displayName,types",
        },
        // Quotes re-resolve the same place many times; details rarely change.
        ...(session ? {} : { next: { revalidate: 60 * 60 * 24 } }),
      });
      if (!place?.location) return null;
      const postcode = normalisePostcode(component(place, "postal_code")?.longText ?? "") ?? undefined;
      const areaInfo = await area({ postcode, lat: place.location.latitude, lng: place.location.longitude });
      return toLocation(place, areaInfo);
    },

    lookupPostcode: (postcode) => fallback.lookupPostcode(postcode),
  };
}
