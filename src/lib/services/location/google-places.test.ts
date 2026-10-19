import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedLocation } from "@/lib/domain/types";
import { estimatedDistance, googleRoutesDistance } from "../distance";
import { googlePlaces, toLocation, type AreaLookup } from "./google-places";
import { postcodesIo } from "./postcodes-io";
import type { LocationProvider } from "./types";

vi.mock("server-only", () => ({}));

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fallback: LocationProvider = {
  search: vi.fn(async () => [{ id: "pc:E1 5NF", kind: "postcode", label: "E1 5NF, Tower Hamlets", postcode: "E1 5NF", lat: 51.5, lng: -0.06 } as ResolvedLocation]),
  resolve: vi.fn(async () => null),
  lookupPostcode: vi.fn(async () => null),
};
const area: AreaLookup = async () => ({ region: "London", district: "Tower Hamlets", outcode: "E1" });

const greatorex = {
  id: "ChIJ-greatorex-street-1",
  formattedAddress: "4-6 Greatorex St, London E1 5NF, UK",
  location: { latitude: 51.5176, longitude: -0.0663 },
  displayName: { text: "4-6 Greatorex St" },
  types: ["street_address"],
  addressComponents: [
    { longText: "4-6", shortText: "4-6", types: ["street_number"] },
    { longText: "Greatorex Street", shortText: "Greatorex St", types: ["route"] },
    { longText: "London", shortText: "London", types: ["postal_town"] },
    { longText: "E1 5NF", shortText: "E1 5NF", types: ["postal_code"] },
    { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
  ],
};

describe("Google address search", () => {
  it("suggests UK addresses and keeps the key out of the URL", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      json({ suggestions: [{ placePrediction: { placeId: "ChIJ-greatorex-street-1", text: { text: "4-6 Greatorex St, London E1 5NF, UK" } } }] }),
    );
    const places = googlePlaces("secret-key", { fallback, area, fetchImpl });
    const results = await places.search("4-6 greatorex", "session-1234");

    expect(results).toEqual([{ id: "gp:ChIJ-greatorex-street-1", kind: "suggestion", label: "4-6 Greatorex St, London E1 5NF" }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).not.toContain("secret-key");
    expect((init?.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("secret-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({ input: "4-6 greatorex", includedRegionCodes: ["gb"], sessionToken: "session-1234" });
  });

  it("falls back to postcode search when Google can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const places = googlePlaces("k", { fallback, area, fetchImpl: async () => json({ error: {} }, 500) });
    const results = await places.search("E1 5NF");
    expect(results[0]).toMatchObject({ id: "pc:E1 5NF" });
  });

  it("resolves a chosen address to its point, postcode, street and region", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => json(greatorex));
    const places = googlePlaces("k", { fallback, area, fetchImpl });
    const loc = await places.resolve("gp:ChIJ-greatorex-street-1");
    expect(loc).toEqual({
      id: "gp:ChIJ-greatorex-street-1",
      kind: "address",
      label: "4-6 Greatorex St, London E1 5NF",
      line1: "4-6 Greatorex Street",
      postcode: "E1 5NF",
      outcode: "E1",
      district: "Tower Hamlets",
      region: "London",
      lat: 51.5176,
      lng: -0.0663,
    });
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/places/ChIJ-greatorex-street-1?");
  });

  it("refuses malformed ids without calling Google, and passes old ids to postcodes.io", async () => {
    const fetchImpl = vi.fn();
    const places = googlePlaces("k", { fallback, area, fetchImpl });
    expect(await places.resolve("gp:../../admin")).toBeNull();
    await places.resolve("pc:E1 5NF");
    expect(fallback.resolve).toHaveBeenCalledWith("pc:E1 5NF");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses a hotel's name as the first line and never invents a partial postcode", () => {
    const hotel = {
      ...greatorex,
      displayName: { text: "Example Hotel" },
      types: ["lodging", "establishment"],
      addressComponents: greatorex.addressComponents.map((c) => (c.types.includes("postal_code") ? { ...c, longText: "E1" } : c)),
    };
    const loc = toLocation(hotel, null)!;
    expect(loc.line1).toBe("Example Hotel, 4-6 Greatorex Street");
    expect(loc.postcode).toBeUndefined();
    expect(loc.region).toBe("London");
  });

  it("rejects places outside the UK, and marks an unknown region as outside London", () => {
    const abroad = { ...greatorex, addressComponents: greatorex.addressComponents.map((c) => (c.types.includes("country") ? { ...c, shortText: "FR" } : c)) };
    expect(toLocation(abroad, null)).toBeNull();
    const elsewhere = { ...greatorex, addressComponents: greatorex.addressComponents.filter((c) => !c.types.includes("postal_town")) };
    expect(toLocation(elsewhere, null)!.region).toBe("Unknown");
  });
});

describe("postcodes.io outside England", () => {
  it("uses the country as the region, so Scottish addresses aren't priced as London", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ result: { postcode: "EH1 1YZ", outcode: "EH1", latitude: 55.95, longitude: -3.19, region: null, country: "Scotland", admin_district: "City of Edinburgh" } }),
    );
    const loc = await postcodesIo.lookupPostcode("EH1 1YZ");
    expect(loc?.region).toBe("Scotland");
  });
});

describe("Google road distance", () => {
  const a = { lat: 51.5176, lng: -0.0663 };
  const b = { lat: 51.47, lng: -0.4543 };

  it("converts Google's metres to miles and remembers the route", async () => {
    const fetchImpl = vi.fn(async () => json({ routes: [{ distanceMeters: 32187 }] }));
    const distance = googleRoutesDistance("k", { fetchImpl });
    expect(await distance.routeMiles([a, b])).toBe(20);
    expect(await distance.routeMiles([a, b])).toBe(20);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the estimate when Google fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const distance = googleRoutesDistance("k", { fetchImpl: async () => json({}, 403) });
    expect(await distance.routeMiles([a, b])).toBe(await estimatedDistance().routeMiles([a, b]));
  });
});

describe("choosing providers", () => {
  it("uses Google search with a key, but real road miles only once switched on", async () => {
    const { chooseDistance, chooseLocations } = await import("../index");
    expect(chooseLocations({})).toBe(postcodesIo);
    expect(chooseLocations({ GOOGLE_MAPS_API_KEY: "k" })).not.toBe(postcodesIo);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await chooseDistance({ GOOGLE_MAPS_API_KEY: "k" }).routeMiles([{ lat: 51.5, lng: -0.1 }, { lat: 51.47, lng: -0.45 }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
