import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FeatureCard, PageHero, Section } from "@/components/sections/blocks";
import { AirportGrid } from "@/components/sections/cards";

export const metadata: Metadata = pageMetadata({
  title: "London Airport Transfers",
  description:
    "Taxi transfers between Greater London and Heathrow, Gatwick, Stansted, Luton and London City airports, in either direction. Instant online quotes.",
  path: "/airport-transfers",
});

export default function AirportTransfersPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Airport Transfers", href: "/airport-transfers" }]}
        eyebrow="Airport transfers"
        title="Transfers between London and its five airports"
        lead="Whether you're heading to departures or landing back home, book a door-to-door transfer between your Greater London address and any London airport."
      />

      <Section id="airports" eyebrow="Choose your airport" title="Where are you flying from?">
        <AirportGrid />
      </Section>

      <Section id="directions" tone="surface" eyebrow="Both directions" title="Drop-offs and pickups">
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard icon="plane" title="To the airport">
            We collect you from your London address and take you to the departures drop-off for your terminal. Add up
            to two stops on the way if you need to collect someone.
          </FeatureCard>
          <FeatureCard icon="pin" title="From the airport">
            Book with your flight number and landing time, and we take you from the airport to your London address.
            Meet &amp; Greet in the arrivals hall is available as an extra.
          </FeatureCard>
        </div>
      </Section>

      <Section id="included" eyebrow="Your quote" title="What's in the price">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="route" title="The journey">
            Based on the airport, the distance to or from your address and the vehicle you choose.
          </FeatureCard>
          <FeatureCard icon="terminal" title="Airport charges">
            Drop-off or pickup parking charges, where they apply, are listed separately and included in the total.
          </FeatureCard>
          <FeatureCard icon="sparkle" title="Extras you choose">
            Extra stops, child seats and Meet &amp; Greet are added only if you select them.
          </FeatureCard>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
