import Link from "next/link";
import { AirportGrid } from "@/components/sections/cards";
import { HeroActions } from "@/components/sections/blocks";
import { RoadSkyline } from "@/components/sections/RoadSkyline";

export default function NotFound() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-night text-white">
        <RoadSkyline compact />
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-28 sm:px-6 lg:pb-32">
          <p className="text-sm font-bold tracking-wider text-accent uppercase">Page not found</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">This page has drifted off course</h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">
            The link may be out of date. Get a quote, or pick an airport below. You can also{" "}
            <Link href="/" className="font-semibold text-white underline">
              go to the homepage
            </Link>
            .
          </p>
          <HeroActions />
        </div>
      </section>
      <div className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <AirportGrid />
        </div>
      </div>
    </>
  );
}
