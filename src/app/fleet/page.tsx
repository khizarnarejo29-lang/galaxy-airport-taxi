import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FeatureCard, PageHero, Section } from "@/components/sections/blocks";
import { FleetGrid } from "@/components/sections/cards";

export const metadata: Metadata = pageMetadata({
  title: "Our Fleet",
  description:
    "Saloon, estate, executive, MPV and 8-seater vehicles for airport transfers across London and the UK. Fixed prices for each vehicle, with free child seats.",
  path: "/fleet",
});

export default function FleetPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Fleet", href: "/fleet" }]}
        eyebrow="Fleet"
        illustration="fleet"
        title="Pick the vehicle that fits your trip"
        lead="Five vehicle classes, from a saloon for one or two travellers to an 8-seater for larger groups."
      />

      <Section
        id="vehicles"
        eyebrow="Vehicle classes"
        title="Our vehicles"
        intro="Passenger numbers are the most each vehicle takes. Boot space differs from car to car, so if you're unsure about your luggage, ask us before you book."
      >
        <FleetGrid />
      </Section>

      <Section id="choosing" tone="surface" eyebrow="Choosing" title="Not sure which one you need?">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="suitcase" title="Tell us about your luggage">
            In the calculator, choose none, hand luggage or suitcases. For large or unusual items, such as bikes or
            golf bags, please call us before booking.
          </FeatureCard>
          <FeatureCard icon="phone" title="Lots of luggage?">
            An estate has room for an extra suitcase, and an MPV or 8-seater takes more. Not sure? Call or WhatsApp us
            and we&apos;ll suggest one.
          </FeatureCard>
          <FeatureCard icon="user" title="Travelling with children">
            Count children and infants as passengers. Child seats are free: tell us how many you need when you book.
          </FeatureCard>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
