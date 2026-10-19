import { describe, expect, it } from "vitest";
import { pricing } from "@/config/pricing";
import { getAirport } from "@/lib/domain/airports";
import type { AirportCode, JourneyEnd, PricedJourney, VehicleId } from "@/lib/domain/types";
import { estimatedDistance } from "@/lib/services/distance";
import { tariffPrice } from "./tariff-pricing";

/** Approximate centre of each sample postcode (as postcodes.io gives them, to about 100 m). */
const postcodes: Record<string, { lat: number; lng: number }> = {
  "SW1A 1AA": { lat: 51.501, lng: -0.1416 },
  "E1 5NF": { lat: 51.5176, lng: -0.0663 },
  "HA9 0WS": { lat: 51.556, lng: -0.2795 },
  "CR0 1LF": { lat: 51.3754, lng: -0.092 },
  "RM1 1AU": { lat: 51.5752, lng: 0.1826 },
  "W5 2NU": { lat: 51.5149, lng: -0.3017 },
};

type Fares = Partial<Record<VehicleId, [oneWay: number, ret: number]>>;

/**
 * Reference website prices in pounds (one way, and return with its 5% offer),
 * seen on 2026-10-19 with no date, passengers or extras entered.
 */
const samples: [postcode: string, airport: AirportCode, terminal: string | null, direction: "to" | "from", fares: Fares][] = [
  ["E1 5NF", "LHR", "T5", "to", {"saloon":[84,160],"executive":[110,208],"estate":[95,180],"mpv":[110,208],"minibus":[136,258]}],
  ["HA9 0WS", "LHR", "T5", "to", {"saloon":[63,120],"executive":[83,158],"estate":[71,134],"mpv":[83,158],"minibus":[110,208]}],
  ["CR0 1LF", "LHR", "T5", "to", {"saloon":[93,176],"executive":[124,236],"estate":[106,200],"mpv":[124,236],"minibus":[137,260]}],
  ["RM1 1AU", "LHR", "T5", "to", {"saloon":[119,226],"executive":[160,304],"estate":[137,260],"mpv":[160,304],"minibus":[177,336]}],
  ["W5 2NU", "LHR", "T5", "to", {"saloon":[58,110],"executive":[77,146],"estate":[66,124],"mpv":[77,146],"minibus":[101,192]}],
  ["E1 5NF", "LGW", "S", "to", {"saloon":[113,216],"executive":[148,282],"estate":[128,244],"mpv":[148,282],"minibus":[162,308]}],
  ["HA9 0WS", "LGW", "S", "to", {"saloon":[116,220],"executive":[155,294],"estate":[132,250],"mpv":[155,294],"minibus":[172,326]}],
  ["CR0 1LF", "LGW", "S", "to", {"saloon":[65,122],"executive":[87,164],"estate":[75,142],"mpv":[87,164],"minibus":[114,216]}],
  ["RM1 1AU", "LGW", "S", "to", {"saloon":[103,196],"executive":[137,260],"estate":[117,222],"mpv":[137,260],"minibus":[152,288]}],
  ["W5 2NU", "LGW", "S", "to", {"saloon":[106,200],"executive":[141,268],"estate":[121,230],"mpv":[141,268],"minibus":[156,296]}],
  ["SW1A 1AA", "STN", null, "to", {"saloon":[119,228],"executive":[154,294],"estate":[134,256],"mpv":[154,294],"minibus":[168,320]}],
  ["E1 5NF", "STN", null, "to", {"saloon":[89,170],"executive":[118,224],"estate":[101,192],"mpv":[118,224],"minibus":[138,262]}],
  ["HA9 0WS", "STN", null, "to", {"saloon":[100,190],"executive":[134,254],"estate":[115,218],"mpv":[134,254],"minibus":[149,282]}],
  ["CR0 1LF", "STN", null, "to", {"saloon":[117,222],"executive":[156,296],"estate":[134,254],"mpv":[156,296],"minibus":[173,328]}],
  ["RM1 1AU", "STN", null, "to", {"saloon":[81,154],"executive":[108,204],"estate":[93,176],"mpv":[108,204],"minibus":[127,240]}],
  ["W5 2NU", "STN", null, "to", {"saloon":[103,196],"executive":[138,262],"estate":[118,224],"mpv":[138,262],"minibus":[153,290]}],
  ["SW1A 1AA", "LTN", null, "to", {"saloon":[99,190],"executive":[127,242],"estate":[111,212],"mpv":[127,242],"minibus":[147,280]}],
  ["E1 5NF", "LTN", null, "to", {"saloon":[91,172],"executive":[119,226],"estate":[103,196],"mpv":[119,226],"minibus":[139,264]}],
  ["HA9 0WS", "LTN", null, "to", {"saloon":[81,154],"executive":[108,204],"estate":[93,176],"mpv":[108,204],"minibus":[128,242]}],
  ["CR0 1LF", "LTN", null, "to", {"saloon":[139,264],"executive":[186,352],"estate":[159,302],"mpv":[186,352],"minibus":[206,390]}],
  ["RM1 1AU", "LTN", null, "to", {"saloon":[103,196],"executive":[138,262],"estate":[118,224],"mpv":[138,262],"minibus":[153,290]}],
  ["W5 2NU", "LTN", null, "to", {"saloon":[84,160],"executive":[111,210],"estate":[95,180],"mpv":[111,210],"minibus":[131,248]}],
  ["SW1A 1AA", "LCY", null, "to", {"saloon":[63,120],"executive":[78,150],"estate":[69,132],"mpv":[78,150],"minibus":[106,202]}],
  ["E1 5NF", "LCY", null, "to", {"saloon":[47,90],"executive":[61,116],"estate":[53,100],"mpv":[61,116],"minibus":[85,162]}],
  ["HA9 0WS", "LCY", null, "to", {"saloon":[80,152],"executive":[107,202],"estate":[92,174],"mpv":[107,202],"minibus":[134,254]}],
  ["CR0 1LF", "LCY", null, "to", {"saloon":[68,130],"executive":[89,170],"estate":[77,146],"mpv":[89,170],"minibus":[115,218]}],
  ["RM1 1AU", "LCY", null, "to", {"saloon":[49,92],"executive":[65,122],"estate":[56,106],"mpv":[65,122],"minibus":[90,170]}],
  ["W5 2NU", "LCY", null, "to", {"saloon":[81,154],"executive":[108,204],"estate":[92,174],"mpv":[108,204],"minibus":[135,256]}],
  ["E1 5NF", "LHR", "T5", "from", {"saloon":[84,160],"executive":[110,208],"estate":[95,180],"mpv":[110,208],"minibus":[136,258]}],
  ["SW1A 1AA", "LGW", "S", "from", {"saloon":[107,204],"executive":[137,262],"estate":[120,228],"mpv":[137,262],"minibus":[159,304]}],
  ["E1 5NF", "LHR", "T2", "from", {"saloon":[76,144],"executive":[99,188],"estate":[86,164],"mpv":[99,188],"minibus":[122,232]}],
  ["SW1A 1AA", "LHR", "T5", "to", {"saloon":[84,160],"executive":[106,202],"estate":[93,178],"mpv":[106,202],"minibus":[129,246]}],
  ["SW1A 1AA", "LGW", "S", "to", {"saloon":[107,204],"executive":[137,262],"estate":[120,228],"mpv":[137,262],"minibus":[159,304]}],
];

const distance = estimatedDistance();

async function journey(
  [postcode, airport, terminal, direction]: (typeof samples)[number],
  tripType: "one_way" | "return",
  place?: { region: string; lat: number; lng: number },
): Promise<PricedJourney> {
  const at = place ? { lat: place.lat, lng: place.lng } : postcodes[postcode];
  const address: JourneyEnd = {
    kind: "address",
    address: { id: `pc:${postcode}`, kind: "postcode", label: postcode, postcode, ...at, ...(place ? { region: place.region } : {}) },
  };
  const air: JourneyEnd = { kind: "airport", airport, ...(terminal ? { terminal } : {}) };
  const miles = await distance.routeMiles([at, getAirport(airport)!]);
  const [pickup, dropoff] = direction === "to" ? [address, air] : [air, address];
  return {
    pickup,
    dropoff,
    extraStops: [],
    date: "2026-11-20",
    time: "12:00",
    pickupAtUtc: "2026-11-20T12:00:00Z",
    passengers: 1,
    luggage: { large: 0, small: 0 },
    distanceMiles: miles,
    tripType,
    largeItems: false,
    extras: { meetAndGreet: false, childSeats: 0 },
    returnJourney:
      tripType === "return"
        ? { pickup: dropoff, extraStops: [], date: "2026-11-27", time: "12:00", pickupAtUtc: "2026-11-27T12:00:00Z", distanceMiles: miles }
        : undefined,
  };
}

describe("Galaxy tariff against the reference website", () => {
  it.each(samples)("is at least £2 under the reference: %s %s %s (%s the airport)", async (...sample) => {
    for (const [vehicleId, [oneWay, ret]] of Object.entries(sample[4]) as [VehicleId, [number, number]][]) {
      for (const [tripType, reference] of [["one_way", oneWay], ["return", ret]] as const) {
        const priced = tariffPrice(await journey(sample, tripType), vehicleId, { meetAndGreet: false, childSeats: 0 }, pricing);
        expect(priced.pricing.status, `${vehicleId} ${tripType}`).toBe("tariff");
        expect(priced.total, `${vehicleId} ${tripType}: £${priced.total / 100} vs reference £${reference}`).toBeLessThanOrEqual(reference * 100 - 200);
      }
    }
  });

  it("keeps child seats, which have no price yet, as price on request", async () => {
    const j = await journey(samples[0], "one_way");
    expect(tariffPrice(j, "saloon", { meetAndGreet: false, childSeats: 1 }, pricing).pricing).toEqual({ status: "price_on_request", reason: "EXTRA_NOT_PRICED" });
  });

  // Reference prices with Meet & Greet (+£6 there), seen on 2026-10-19.
  it.each([
    ["SW1A 1AA", "LHR", "T5", 84 + 6],
    ["E1 5NF", "STN", null, 89 + 6],
  ] as const)("stays £2 under with Meet & Greet: %s from %s", async (postcode, airport, terminal, reference) => {
    const j = await journey([postcode, airport, terminal, "from", {}], "one_way");
    const priced = tariffPrice(j, "saloon", { meetAndGreet: true, childSeats: 0 }, pricing);
    expect(priced.lines.map((l) => l.code)).toContain("meet_and_greet");
    expect(priced.total).toBeLessThanOrEqual(reference * 100 - 200);
  });

  it("stays £2 under with a stop on the way (E1 5NF via SW1A 1AA to Heathrow T5)", async () => {
    // Reference prices for that route, one way.
    const reference: Fares = { saloon: [100, 0], executive: [126, 0], estate: [111, 0], mpv: [126, 0], minibus: [152, 0] };
    const direct = await journey(["E1 5NF", "LHR", "T5", "to", {}], "one_way");
    const stop = { id: "pc:SW1A 1AA", kind: "postcode" as const, label: "SW1A 1AA", postcode: "SW1A 1AA", ...postcodes["SW1A 1AA"] };
    const airport = getAirport("LHR")!;
    const via: PricedJourney = {
      ...direct,
      extraStops: [stop],
      distanceMiles: await distance.routeMiles([postcodes["E1 5NF"], stop, airport]),
    };
    for (const [vehicleId, [price]] of Object.entries(reference) as [VehicleId, [number, number]][]) {
      const priced = tariffPrice(via, vehicleId, { meetAndGreet: false, childSeats: 0 }, pricing);
      expect(priced.total, vehicleId).toBeLessThanOrEqual(price * 100 - 200);
    }
  });

  it("shows no discount line on a return: both legs are simply lower", async () => {
    const priced = tariffPrice(await journey(samples[0], "return"), "saloon", { meetAndGreet: false, childSeats: 0 }, pricing);
    expect(priced.lines.map((l) => l.code)).toEqual(["journey", "return_journey"]);
  });

  // Outside London, seen on the reference website on 2026-10-19 (one way, and return with its offer).
  const outside: [postcode: string, region: string, at: { lat: number; lng: number }, airport: AirportCode, terminal: string | null, fares: Fares][] = [
    ["B1 1BB", "West Midlands", { lat: 52.4796, lng: -1.9026 }, "LHR", "T5", { saloon: [183, 346], executive: [247, 468], estate: [211, 400], mpv: [247, 468], minibus: [275, 522] }],
    ["M1 1AE", "North West", { lat: 53.4794, lng: -2.2453 }, "LHR", "T5", { saloon: [287, 544], executive: [387, 734], estate: [330, 626], mpv: [387, 734], minibus: [430, 816] }],
    ["BN1 1AA", "South East", { lat: 50.8279, lng: -0.1395 }, "LGW", "S", { saloon: [71, 134], executive: [96, 182], estate: [82, 154], mpv: [96, 182], minibus: [121, 228] }],
    ["MK9 1AA", "South East", { lat: 52.0423, lng: -0.7583 }, "LTN", null, { saloon: [65, 122], executive: [88, 166], estate: [75, 142], mpv: [88, 166], minibus: [111, 210] }],
  ];

  it.each(outside)("is at least £2 under the reference outside London: %s", async (postcode, region, at, airport, terminal, fares) => {
    for (const tripType of ["one_way", "return"] as const) {
      const j = await journey([postcode, airport, terminal, "to", fares], tripType, { region, ...at });
      for (const [vehicleId, [oneWay, ret]] of Object.entries(fares) as [VehicleId, [number, number]][]) {
        const reference = tripType === "one_way" ? oneWay : ret;
        const priced = tariffPrice(j, vehicleId, { meetAndGreet: false, childSeats: 0 }, pricing);
        expect(priced.total, `${vehicleId} ${tripType}: £${priced.total / 100} vs £${reference}`).toBeLessThanOrEqual(reference * 100 - 200);
      }
    }
  });
});

