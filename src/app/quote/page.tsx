import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { Calculator } from "@/components/calculator/Calculator";
import { airports } from "@/lib/domain/airports";
import type { AirportCode, Direction } from "@/lib/domain/types";

export const metadata: Metadata = pageMetadata({
  title: "Get a Quote",
  description:
    "Get an instant price for a transfer between London and Heathrow, Gatwick, Stansted, Luton or London City airport.",
  path: "/quote",
});

/** Supports deep links such as /quote?airport=LGW&direction=from_airport. */
export default async function QuotePage({ searchParams }: PageProps<"/quote">) {
  const params = await searchParams;
  const airport = airports.find((a) => a.code === params.airport)?.code as AirportCode | undefined;
  const direction = (["to_airport", "from_airport"] as const).find((d) => d === params.direction) as
    | Direction
    | undefined;

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <h1 className="mb-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Get an instant quote</h1>
        <p className="mb-5 text-ink-soft">London to the airport, or the airport to London. Prices for every vehicle.</p>
        <Calculator variant="hero" initialAirport={airport} initialDirection={direction} />
      </div>
    </div>
  );
}
