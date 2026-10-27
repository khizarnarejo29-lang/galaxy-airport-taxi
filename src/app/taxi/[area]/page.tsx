import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand, FaqList, RelatedLinks, Section } from "@/components/sections/blocks";
import { CalculatorHero } from "@/components/sections/CalculatorHero";
import { PriceTable } from "@/components/sections/cards";
import { JsonLd } from "@/components/seo/JsonLd";
import { airportRows, areaFaqs, localRows } from "@/content/area-pages";
import { airportsByDistance, areas, getArea, nearbyAreas } from "@/content/areas";
import { getAirport } from "@/lib/domain/airports";
import { faqPage, taxiService } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return areas.map((a) => ({ area: a.slug }));
}

const describe = (name: string) =>
  `Fixed-price taxis in ${name}: airport transfers to Heathrow, Gatwick, Stansted, Luton and London City, and local rides anywhere. Book online 24/7.`;

export async function generateMetadata({ params }: PageProps<"/taxi/[area]">): Promise<Metadata> {
  const area = getArea((await params).area);
  if (!area) return {};
  return pageMetadata({
    title: `${area.shortName ?? area.name} Taxi and Airport Transfers`,
    description: describe(area.name),
    path: `/taxi/${area.slug}`,
  });
}

export default async function AreaPage({ params }: PageProps<"/taxi/[area]">) {
  const area = getArea((await params).area);
  if (!area) notFound();
  const toAirports = airportRows(area);
  const local = localRows(area);
  const faqs = areaFaqs(area);
  const nearby = nearbyAreas(area, 4);
  const nearestAirport = getAirport(airportsByDistance(area)[0])!;

  return (
    <>
      <JsonLd
        data={taxiService({
          name: `${area.name} taxi`,
          description: describe(area.name),
          path: `/taxi/${area.slug}`,
          place: `${area.name}, London`,
        })}
      />
      <JsonLd data={faqPage(faqs)} />
      <CalculatorHero
        crumbs={[{ label: "Taxi", href: "/taxi" }, { label: area.name, href: `/taxi/${area.slug}` }]}
        eyebrow={`London Borough of ${area.borough}`}
        title={`${area.name} taxi`}
        lead={`Fixed-price taxis from ${area.name} to ${nearestAirport.name} and the other London airports, and for local journeys around the borough of ${area.borough} and beyond. See your price for every vehicle before you book.`}
        initialLocal
        illustration="london"
      />

      <Section id="about" eyebrow={area.borough === area.name ? "The area" : `London Borough of ${area.borough}`} title={`About ${area.name}`}>
        <p className="max-w-3xl text-lg leading-relaxed text-ink-soft">{area.about}</p>
      </Section>

      <Section
        id="airports"
        tone="surface"
        eyebrow="Airport transfers"
        title={`Taxi from ${area.name} to the airports`}
        intro={
          <>
            One way from the centre of {area.name}, for the whole vehicle, airport charges included, nearest airport
            first. A return costs less than two one-way trips.{" "}
            <Link href="/prices" className="font-semibold text-sky underline underline-offset-2">
              Compare prices from other areas
            </Link>
          </>
        }
      >
        <PriceTable label={`${area.name} to the airports`} firstColumn="To" rows={toAirports} />
      </Section>

      <Section
        id="local"
        eyebrow="Local rides"
        title={`Local journeys from ${area.name}`}
        intro="Hospital appointments, stations, the office or a night out: any journey, at a fixed price. These are examples from the centre of each place."
      >
        <PriceTable label={`Journeys from ${area.name}`} firstColumn="To" rows={local} />
      </Section>

      <Section id="questions" tone="surface" eyebrow="Questions" title={`${area.name} taxi questions`}>
        <div className="max-w-3xl">
          <FaqList items={faqs} />
        </div>
      </Section>

      <Section id="nearby" eyebrow="Nearby" title="Taxis in nearby areas">
        <RelatedLinks
          links={nearby.map((a) => ({
            href: `/taxi/${a.slug}`,
            title: `${a.name} taxi`,
            text: `Airport transfers and local rides from ${a.name}.`,
          }))}
        />
      </Section>

      <CtaBand title={`Book your ${area.name} taxi`} />
    </>
  );
}
