import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, FaqList, FeatureCard, RelatedLinks, Section } from "@/components/sections/blocks";
import { CalculatorHero } from "@/components/sections/CalculatorHero";
import { PriceTable } from "@/components/sections/cards";
import { JsonLd } from "@/components/seo/JsonLd";
import { exampleRouteRows } from "@/content/area-pages";
import { areas } from "@/content/areas";
import { faqPage, taxiService } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { site } from "@/config/site";

const description =
  "Fixed-price taxis for any journey in London and the UK: hospital appointments, train stations, the office, shopping and long-distance trips. Book online 24/7.";

export const metadata: Metadata = pageMetadata({ title: "London Taxi for Any Journey", description, path: "/taxi" });

const uses = [
  { icon: "plus", title: "Hospital appointments", text: "Get to your appointment and home again without parking or changing trains. Book the return at the same time." },
  { icon: "route", title: "Train and coach stations", text: "Door to door to any London terminus or coach station, with room for your luggage." },
  { icon: "user", title: "Office and business", text: "Meetings, client visits and late finishes, with one fixed price agreed before you travel." },
  { icon: "bag", title: "Shopping and days out", text: "Shopping centres, events, restaurants and family visits, with space for whatever you bring back." },
  { icon: "pin", title: "Long distance", text: "From London to anywhere in the UK, such as Cambridge, Oxford, Brighton or Birmingham." },
  { icon: "plane", title: "Airport transfers", text: "All five London airports, with 60 minutes' free waiting after you land." },
] as const;

const faqs = [
  {
    q: "Can I book a taxi that doesn't go to an airport?",
    a: "Yes. Choose “Address or postcode” for both pickup and drop-off in the calculator and you'll see a fixed price for each vehicle.",
  },
  {
    q: "Is the price fixed?",
    a: "Yes. The price you see before you book is the price you pay for the whole vehicle, not per person. Traffic doesn't change it.",
  },
  {
    q: "Can you take me to a hospital appointment and bring me back?",
    a: "Yes. Book a return in the calculator and choose the time to collect you. A return costs less than two one-way trips.",
  },
  {
    q: "Do you cover my area?",
    a: "We cover every address in London and the rest of the UK. Enter your postcode or street in the calculator to see your price.",
  },
];

export default function LocalTaxiPage() {
  const rows = exampleRouteRows();
  return (
    <>
      <JsonLd data={taxiService({ name: "Taxi for any journey", description, path: "/taxi" })} />
      <JsonLd data={faqPage(faqs)} />
      <CalculatorHero
        crumbs={[{ label: "Taxi", href: "/taxi" }]}
        eyebrow="Any journey"
        title="A taxi for any journey, not just the airport"
        lead={`Hospital, station, office or a night out: ${site.name} takes you between any two addresses in London and across the UK, at a fixed price you see before you book.`}
        initialLocal
        illustration="london"
      />

      <Section id="uses" eyebrow="Where we take you" title="Everyday journeys, booked in minutes">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {uses.map((u) => (
            <FeatureCard key={u.title} icon={u.icon} title={u.title}>
              {u.text}
            </FeatureCard>
          ))}
        </div>
      </Section>

      {rows.length > 0 && (
        <Section
          id="prices"
          tone="surface"
          eyebrow="Fixed prices"
          title="Example prices"
          intro="One way, for the whole vehicle, between the centres of these places. Your exact price depends on the addresses: enter them above."
        >
          <PriceTable label="Example journeys" firstColumn="Journey" rows={rows} />
        </Section>
      )}

      <Section id="areas" eyebrow="Areas" title="Taxis across London">
        <ul className="flex flex-wrap gap-3">
          {areas.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/taxi/${a.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 py-2 font-semibold transition hover:border-ink"
              >
                {a.name} taxi
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="questions" tone="surface" eyebrow="Questions" title="About local journeys">
        <div className="max-w-3xl">
          <FaqList items={faqs} />
        </div>
      </Section>

      <Section id="related" eyebrow="Plan your trip" title="Before you book">
        <RelatedLinks
          links={[
            { href: "/fleet", title: "Choose a vehicle", text: "Saloon to 8-seater, and how many passengers each one takes." },
            { href: "/prices", title: "Airport prices", text: "Fixed prices from across London to all five airports." },
            { href: "/faq", title: "FAQ", text: "Waiting time, child seats, booking notice and more." },
            { href: "/terms", title: "Terms", text: "Cancellation, refunds and what's included in your price." },
          ]}
        />
      </Section>

      <CtaBand />
    </>
  );
}
