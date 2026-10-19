import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { CtaBand, FaqList, FeatureCard, Section } from "@/components/sections/blocks";
import { AirportGrid, ExampleFaresTable } from "@/components/sections/cards";
import { exampleFares } from "@/lib/pricing/example-fares";
import { CalculatorHero } from "@/components/sections/CalculatorHero";
import { airportContent } from "@/content/airports";
import { airports } from "@/lib/domain/airports";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return airports.map((a) => ({ airport: a.slug }));
}

function find(slug: string) {
  const airport = airports.find((a) => a.slug === slug);
  return airport ? { airport, content: airportContent[airport.code] } : null;
}

export async function generateMetadata({ params }: PageProps<"/[airport]">): Promise<Metadata> {
  const found = find((await params).airport);
  if (!found) return {};
  return pageMetadata({
    title: found.content.metaTitle,
    description: found.content.metaDescription,
    path: `/${found.airport.slug}`,
    image: { url: `/${found.airport.slug}/opengraph-image`, alt: `${found.airport.name} transfers` },
  });
}

export default async function AirportPage({ params }: PageProps<"/[airport]">) {
  const found = find((await params).airport);
  if (!found) notFound();
  const { airport, content } = found;

  return (
    <>
      <CalculatorHero
        crumbs={[{ label: "Airport Transfers", href: "/airport-transfers" }, { label: airport.shortName, href: `/${airport.slug}` }]}
        title={content.h1}
        lead={content.lead}
        initialAirport={airport.code}
        scene="takeoff"
        illustration="airport"
      >
        <p className="flex items-start gap-3 text-white/75">
          <Icon name="pin" className="mt-1 size-5 shrink-0 text-accent" />
          {content.location}
        </p>
      </CalculatorHero>

      {exampleFares(airport.code).length > 0 && (
        <Section
          id="prices"
          eyebrow="Fixed prices"
          title={`Example prices to and from ${airport.shortName}`}
          intro={
            <>
              One way, for the whole vehicle, airport charges included
              {airport.terminals.length > 1 ? ", from the lowest-priced terminal" : ""}. A return costs less than two
              one-way trips. Enter your address above for your exact price.
            </>
          }
        >
          <ExampleFaresTable airport={airport.code} />
        </Section>
      )}

      <Section id="terminals" eyebrow="Terminals" title={`${airport.name} terminals`} intro={content.terminalsIntro}>
        {airport.terminals.length > 1 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {airport.terminals.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4">
                <Icon name="terminal" className="size-5 text-accent-strong" />
                <span className="font-semibold">{t.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inline-flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4 font-semibold">
            <Icon name="terminal" className="size-5 text-accent-strong" />
            One passenger terminal
          </p>
        )}
      </Section>

      <Section
        id="journeys"
        tone="surface"
        eyebrow="Both directions"
        title={`To and from ${airport.shortName}`}
        intro="Choose your direction in the first step of the calculator. Everything else adjusts to suit."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard icon="plane" title={`London to ${airport.shortName}`}>
            {content.dropOff}
          </FeatureCard>
          <FeatureCard icon="pin" title={`${airport.shortName} to London`}>
            {content.pickup}
          </FeatureCard>
        </div>
      </Section>

      <Section id="faq" eyebrow="Questions" title={`${airport.shortName} transfer FAQs`}>
        <div className="max-w-3xl">
          <FaqList items={content.faqs} />
        </div>
      </Section>

      <Section id="other-airports" tone="surface" eyebrow="Other airports" title="Transfers to the other London airports">
        <AirportGrid exclude={airport.code} />
      </Section>

      <CtaBand
        title={`Price your ${airport.shortName} transfer`}
        quoteHref={`/quote?airport=${airport.code}`}
      />
    </>
  );
}
