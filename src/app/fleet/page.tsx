import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FeatureCard, PageHero, Section } from "@/components/sections/blocks";
import { FleetGrid } from "@/components/sections/cards";

export const metadata: Metadata = pageMetadata({
  title: "Our Fleet",
  description:
    "Saloon, estate, executive, MPV and 8-seater vehicles for London airport transfers. See passenger and luggage capacity for each.",
  path: "/fleet",
});

export default function FleetPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Fleet", href: "/fleet" }]}
        eyebrow="Fleet"
        title="Pick the vehicle that fits your trip"
        lead="Five vehicle classes, from a saloon for one or two travellers to an 8-seater for larger groups. Each one lists exactly how many people and bags it carries."
      />

      <Section
        id="vehicles"
        eyebrow="Vehicle classes"
        title="Seats and luggage at a glance"
        intro="Figures are the maximum for each class. A spare large-case space can also take a small bag."
      >
        <FleetGrid />
      </Section>

      <Section id="choosing" tone="surface" eyebrow="Choosing" title="Not sure which one you need?">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="suitcase" title="Count your cases">
            Large cases are checked-in suitcases. Small bags are cabin bags, rucksacks and similar. Enter both in the
            calculator.
          </FeatureCard>
          <FeatureCard icon="check" title="Let the calculator decide">
            Only vehicles with enough room for your passengers and luggage can be selected. The rest show why they
            don&apos;t fit.
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
