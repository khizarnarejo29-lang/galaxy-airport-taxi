import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { taxiService } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FeatureCard, PageHero, Section } from "@/components/sections/blocks";
import { AirportGrid } from "@/components/sections/cards";

const description =
  "Fixed-price taxis between any UK address and Heathrow, Gatwick, Stansted, Luton and London City airports, in either direction. Book online 24/7.";

export const metadata: Metadata = pageMetadata({ title: "London Airport Transfers", description, path: "/airport-transfers" });

export default function AirportTransfersPage() {
  return (
    <>
      <JsonLd data={taxiService({ name: "Airport transfers", description, path: "/airport-transfers" })} />
      <PageHero
        crumbs={[{ label: "Airport Transfers", href: "/airport-transfers" }]}
        eyebrow="Airport transfers"
        illustration="airport"
        scene="takeoff"
        title="Transfers between London and its five airports"
        lead="Whether you're heading to departures or landing back home, book a door-to-door transfer between your address, in London or anywhere in the UK, and any London airport."
      />

      <Section id="airports" eyebrow="Choose your airport" title="Where are you flying from?">
        <AirportGrid />
      </Section>

      <Section id="directions" tone="surface" eyebrow="Both directions" title="Drop-offs and pickups">
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard icon="plane" title="To the airport">
            We collect you from your address and take you to the departures drop-off for your terminal. Add up
            to two stops on the way if you need to collect someone.
          </FeatureCard>
          <FeatureCard icon="pin" title="From the airport">
            Book with your flight number and landing time, and we take you from the airport to your address.
            Meet &amp; Greet in the arrivals hall is available as an extra.
          </FeatureCard>
        </div>
      </Section>

      <Section id="included" eyebrow="Your quote" title="How your price works">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="route" title="One fixed total">
            An online price is a single fixed total for your booking, covering both journeys if you book a return.
          </FeatureCard>
          <FeatureCard icon="sparkle" title="Stops and extras">
            Tell us about any stops, child seats or Meet &amp; Greet before you see prices. Stops and Meet &amp; Greet are
            added to your total, and child seats are free.
          </FeatureCard>
          <FeatureCard icon="phone" title="Price on request">
            If a journey can&apos;t be priced online, it shows &ldquo;Price on request&rdquo;. Call or WhatsApp us and
            we&apos;ll give you a fixed price.
          </FeatureCard>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
