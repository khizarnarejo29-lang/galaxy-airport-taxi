import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { Calculator } from "@/components/calculator/Calculator";
import { RoadSkyline } from "@/components/sections/RoadSkyline";
import { airports } from "@/lib/domain/airports";
import type { AirportCode, Direction } from "@/lib/domain/types";

export const metadata: Metadata = pageMetadata({
  title: "Get a Quote",
  description:
    "Get a fixed price for a transfer between London and Heathrow, Gatwick, Stansted, Luton or London City airport, online where available or by phone.",
  path: "/quote",
});

/** Supports deep links such as /quote?airport=LGW&direction=from_airport. */
export default async function QuotePage({ searchParams }: PageProps<"/quote">) {
  const params = await searchParams;
  const airport = airports.find((a) => a.code === params.airport)?.code as AirportCode | undefined;
  const direction = (["to_airport", "from_airport"] as const).find((d) => d === params.direction) as
    | Direction
    | undefined;

  // Side by side on desktop; on phones a short intro, then straight into the calculator.
  return (
    <section className="relative isolate overflow-clip bg-night text-white">
      <RoadSkyline scene="takeoff" />
      <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-5 px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:grid-cols-[1fr_minmax(0,30rem)] lg:pt-14 lg:pb-28">
        <div className="lg:pt-6">
          <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:text-5xl">Get a quote</h1>
          <p className="mt-2 max-w-md leading-relaxed text-white/75 sm:mt-4 sm:text-lg">From any UK address to the airport, or the airport to your door. Enter your journey to see a fixed total for each vehicle, then book online.</p>
        </div>
        <div>
          <Calculator variant="hero" initialAirport={airport} initialDirection={direction} />
        </div>
      </div>
    </section>
  );
}
