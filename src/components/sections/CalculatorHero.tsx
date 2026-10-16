import type { ReactNode } from "react";
import { Calculator } from "@/components/calculator/Calculator";
import type { AirportCode } from "@/lib/domain/types";
import { Breadcrumbs, type Crumb } from "./blocks";
import { RoadSkyline } from "./RoadSkyline";

interface Props {
  crumbs?: Crumb[];
  eyebrow?: string;
  title: ReactNode;
  lead: string;
  initialAirport?: AirportCode;
  /** Shown below the calculator on phones, under the intro on desktop. */
  children?: ReactNode;
}

/** Hero with the quote calculator. On phones the calculator comes straight after the headline. */
export function CalculatorHero({ crumbs, eyebrow, title, lead, initialAirport, children }: Props) {
  return (
    <section id="quote" className="relative isolate scroll-mt-16 overflow-hidden bg-night text-white">
      <RoadSkyline />
      <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-8 px-4 pt-7 pb-14 sm:px-6 sm:pt-10 lg:grid-cols-[1fr_minmax(0,30rem)] lg:grid-rows-[auto_1fr] lg:pt-14 lg:pb-24">
        <div className="lg:pt-6">
          {crumbs && (
            <div className="mb-6 lg:mb-8">
              <Breadcrumbs items={crumbs} />
            </div>
          )}
          {eyebrow && (
            <p className="mb-5 hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-white/80 uppercase sm:inline-flex">
              <span className="size-1.5 rounded-full bg-accent" />
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[2.3rem] leading-[1.02] font-extrabold tracking-tight text-balance sm:text-6xl">
            {title}
          </h1>
          <p className="mt-3 max-w-xl leading-relaxed text-white/75 sm:mt-5 sm:text-lg">{lead}</p>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Calculator variant="hero" initialAirport={initialAirport} />
        </div>

        {children && <div>{children}</div>}
      </div>
    </section>
  );
}
