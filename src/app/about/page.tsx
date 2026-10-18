import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FeatureCard, PageHero, Section } from "@/components/sections/blocks";
import { site } from "@/config/site";

export const metadata: Metadata = pageMetadata({
  title: "About Us",
  description:
    "Galaxy Airport Taxi arranges transfers between Greater London and the five London airports, with fixed prices agreed before you book.",
  path: "/about",
});

/** Only facts about how the service works. Company details appear once set in config/site.ts. */
export default function AboutPage() {
  const details = [site.companyDetails, site.licence, site.address].filter(Boolean) as string[];

  return (
    <>
      <PageHero
        crumbs={[{ label: "About Us", href: "/about" }]}
        eyebrow="About us"
        illustration="london"
        title="Airport transfers, kept simple"
        lead={`${site.name} focuses on one thing: getting you between your London address and Heathrow, Gatwick, Stansted, Luton or London City airport.`}
      />

      <Section id="approach" eyebrow="How we work" title="Fixed prices, straightforward booking">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="check" title="Price before you book">
            Where we can price your journey online, you see one fixed total for the booking before you confirm. If not,
            it shows &ldquo;Price on request&rdquo; and we&apos;ll give you a price by phone.
          </FeatureCard>
          <FeatureCard icon="suitcase" title="The right vehicle">
            You tell us how many people and bags are travelling. Where we can&apos;t confirm a vehicle for your luggage
            online, we&apos;ll check it with you by phone.
          </FeatureCard>
          <FeatureCard icon="plane" title="Built around your flight">
            Pickups are booked against your flight number and landing time, so the details travel with your booking.
          </FeatureCard>
        </div>
      </Section>

      <Section id="contact" tone="surface" eyebrow="Get in touch" title="Talk to us">
        <div className="max-w-2xl space-y-3 text-lg leading-relaxed text-ink-soft">
          <p>
            Call{" "}
            <a href={site.phone.href} className="font-semibold text-ink underline">
              {site.phone.display}
            </a>{" "}
            or email{" "}
            <a href={`mailto:${site.email}`} className="font-semibold text-ink underline">
              {site.email}
            </a>
            .
          </p>
          {details.map((d) => (
            <p key={d} className="text-base">
              {d}
            </p>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
