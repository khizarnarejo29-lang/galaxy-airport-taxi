import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { CtaBand, FaqList, NumberedSteps, Section } from "@/components/sections/blocks";
import { AirportGrid, FleetGrid } from "@/components/sections/cards";
import { CalculatorHero } from "@/components/sections/CalculatorHero";
import { Icon, type IconName } from "@/components/ui/Icon";
import { faqGroups } from "@/content/faqs";
import { services } from "@/content/services";
import { airports } from "@/lib/domain/airports";
import { localBusiness, webSite } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const points: { icon: IconName; text: string }[] = [
  { icon: "check", text: "Your price is shown before you book" },
  { icon: "plane", text: "Flight number recorded for every airport pickup" },
  { icon: "user", text: "Saloons through to 8-seaters" },
];

const steps = [
  {
    title: "Tell us the journey",
    text: "Choose to or from the airport, find your London address and add the date, time and who's travelling.",
  },
  {
    title: "Compare vehicles",
    text: "See a price for every vehicle that fits your group and luggage, with each charge listed separately.",
  },
  {
    title: "Book and keep your reference",
    text: "Add your contact details and any extras, check the summary and book. You'll get a booking reference straight away.",
  },
];

export default function HomePage() {
  const faqPreview = faqGroups().flatMap((g) => g.items).slice(0, 5);

  return (
    <>
      <JsonLd data={webSite()} />
      {/* Withheld (null) while contact details are placeholders. */}
      <JsonLd data={localBusiness()} />
      <CalculatorHero
        eyebrow="London airport transfers"
        title={
          <>
            Your airport run, <span className="text-accent">priced up front.</span>
          </>
        }
        lead="Door-to-door journeys between any Greater London address and all five London airports. Tell us the route, compare every vehicle's price, then book in a few taps."
      >
        <ul className="space-y-3">
          {points.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-white/85">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
                <Icon name={p.icon} className="size-4 text-accent" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Airports we serve">
          {airports.map((a) => (
            <li key={a.code}>
              <Link
                href={`/${a.slug}`}
                className="inline-block rounded-full bg-white/8 px-3 py-1.5 text-sm font-medium text-white/80 ring-1 ring-white/10 hover:bg-white/15 hover:text-white"
              >
                {a.shortName}
              </Link>
            </li>
          ))}
        </ul>
      </CalculatorHero>

      <Section id="how-it-works" eyebrow="How it works" title="From quote to booking in three steps">
        <NumberedSteps steps={steps} />
      </Section>

      <Section
        id="airports"
        tone="surface"
        eyebrow="Airport transfers"
        title="All five London airports"
        intro="Transfers in both directions between Greater London and each airport, with terminal selection where the airport has more than one."
      >
        <AirportGrid />
      </Section>

      <Section
        id="services"
        eyebrow="Services"
        title="Drop-offs, pickups and the extras that go with them"
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className="group flex h-full flex-col rounded-3xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-ink-faint hover:shadow-card"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
                  <Icon name={s.icon} className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{s.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
                  Learn more
                  <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="fleet"
        tone="surface"
        eyebrow="Fleet"
        title="A vehicle for every group size"
        intro="Maximum passengers and luggage for each vehicle class. The calculator only offers vehicles that fit your group."
      >
        <FleetGrid />
      </Section>

      <Section id="faq" eyebrow="FAQ" title="Common questions">
        <div className="max-w-3xl">
          <FaqList items={faqPreview} />
          <Link href="/faq" className="mt-6 inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
            See all questions
            <Icon name="arrowRight" className="size-4" />
          </Link>
        </div>
      </Section>

      <CtaBand quoteHref="#quote" />
    </>
  );
}
