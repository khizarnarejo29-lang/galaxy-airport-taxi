import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, FaqList, PageHero, RelatedLinks, Section } from "@/components/sections/blocks";
import { ExampleFaresTable } from "@/components/sections/cards";
import { JsonLd } from "@/components/seo/JsonLd";
import { priceFaqs } from "@/content/prices";
import { airports } from "@/lib/domain/airports";
import { exampleFares } from "@/lib/pricing/example-fares";
import { faqPage } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";

const description =
  "Fixed airport taxi prices from London to Heathrow, Gatwick, Stansted, Luton and London City, for every vehicle. Whole-car prices, airport charges included.";

export const metadata: Metadata = pageMetadata({ title: "Airport Taxi Prices", description, path: "/prices" });

export default function PricesPage() {
  const faqs = priceFaqs();
  const priced = airports.filter((a) => exampleFares(a.code).length > 0);

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqPage(faqs)} />}
      <PageHero
        crumbs={[{ label: "Prices", href: "/prices" }]}
        eyebrow="Prices"
        illustration="airport"
        scene="takeoff"
        title="Airport taxi prices"
        lead="Fixed one-way prices from six parts of London to each airport, for every vehicle. Each price is for the whole car, with airport charges included. Enter your own address for your exact price."
      />

      {priced.map((a, i) => (
        <Section
          key={a.code}
          id={`prices-${a.code.toLowerCase()}`}
          tone={i % 2 ? "surface" : "white"}
          eyebrow={a.code}
          title={`${a.name} taxi prices`}
          intro={
            <>
              One way{a.terminals.length > 1 ? ", from the lowest-priced terminal" : ""}. A return costs less than two
              one-way trips.{" "}
              <Link href={`/${a.slug}`} className="font-semibold text-sky underline underline-offset-2">
                More about {a.shortName} transfers
              </Link>
            </>
          }
        >
          <ExampleFaresTable airport={a.code} />
        </Section>
      ))}

      {faqs.length > 0 && (
        <Section id="questions" eyebrow="Questions" title="About our prices">
          <div className="max-w-3xl">
            <FaqList items={faqs} />
          </div>
        </Section>
      )}

      <Section id="related" tone="surface" eyebrow="Plan your trip" title="Before you book">
        <RelatedLinks
          links={[
            { href: "/fleet", title: "Choose a vehicle", text: "Saloon to 8-seater, and how many passengers each one takes." },
            { href: "/services/meet-and-greet", title: "Meet & Greet", text: "Your driver waits in arrivals with a sign showing your name." },
            { href: "/faq", title: "FAQ", text: "Waiting time, flight delays, child seats and booking notice." },
            { href: "/terms", title: "Terms", text: "Cancellation, refunds and what's included in your price." },
          ]}
        />
      </Section>

      <CtaBand title="Get your exact price" />
    </>
  );
}
