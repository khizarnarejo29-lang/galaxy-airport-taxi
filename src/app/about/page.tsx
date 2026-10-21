import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FeatureCard, PageHero, Section } from "@/components/sections/blocks";
import { site } from "@/config/site";

export const metadata: Metadata = pageMetadata({
  title: "About Us",
  description:
    "Galaxy Airport Taxi arranges transfers between anywhere in the UK and the five London airports, with fixed prices agreed before you book.",
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
        title="About Galaxy Airport Taxi"
        lead={`${site.name} takes you between your address and Heathrow, Gatwick, Stansted, Luton or London City airport, and on any other journey across London and the UK, at a fixed price.`}
      />

      <Section id="approach" eyebrow="How we work" title="Fixed prices, straightforward booking">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="check" title="Price before you book">
            You see one fixed total for the booking before you confirm. If a journey can&apos;t be priced online, it
            shows &ldquo;Price on request&rdquo; and we&apos;ll give you a price by phone or WhatsApp.
          </FeatureCard>
          <FeatureCard icon="suitcase" title="The right vehicle">
            Tell us how many people and bags are travelling and you&apos;ll see the cars that fit. For bikes, golf bags
            or anything unusual, call us first.
          </FeatureCard>
          <FeatureCard icon="plane" title="We follow your flight">
            Give us your flight number and we track it. If you land late, your driver waits: the first 60 minutes after
            landing are free.
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
