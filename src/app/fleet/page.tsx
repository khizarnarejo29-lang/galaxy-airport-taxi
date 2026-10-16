import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FeatureCard, PageHero, Section } from "@/components/sections/blocks";
import { FleetGrid } from "@/components/sections/cards";

export const metadata: Metadata = pageMetadata({
  title: "Our Fleet",
  description:
    "Saloon, estate, executive, MPV and 8-seater vehicles for London airport transfers. Call us if you are unsure which vehicle fits your luggage.",
  path: "/fleet",
});

export default function FleetPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Fleet", href: "/fleet" }]}
        eyebrow="Fleet"
        title="Pick the vehicle that fits your trip"
        lead="Five vehicle classes, from a saloon for one or two travellers to an 8-seater for larger groups."
      />

      <Section
        id="vehicles"
        eyebrow="Vehicle classes"
        title="Vehicle classes at a glance"
        intro="Passenger numbers are a typical maximum for each class. Luggage space varies by vehicle, so we confirm it for your journey rather than list it here."
      >
        <FleetGrid />
      </Section>

      <Section id="choosing" tone="surface" eyebrow="Choosing" title="Not sure which one you need?">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="suitcase" title="Tell us about your luggage">
            In the calculator, choose none, hand luggage or suitcases. For large or unusual items, such as bikes or
            golf bags, please call us before booking.
          </FeatureCard>
          <FeatureCard icon="phone" title="Not sure it will fit?">
            If we can&apos;t confirm a vehicle for your luggage online, it shows &ldquo;Price on request&rdquo;. Call us and
            we&apos;ll find the right vehicle.
          </FeatureCard>
          <FeatureCard icon="user" title="Travelling with children">
            Count children and infants as passengers. Child seats can be added as an extra when you book.
          </FeatureCard>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
