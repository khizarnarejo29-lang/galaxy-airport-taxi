import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { InstallButton } from "@/components/app/InstallButton";
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
  { icon: "check", text: "Fixed price for the whole car, shown before you book" },
  { icon: "clock", text: "60 minutes' free waiting after your flight lands" },
  { icon: "user", text: "Child seats free, saloons to 8-seaters" },
  { icon: "phone", text: "Open 24 hours: book online, call or WhatsApp" },
];

const steps = [
  {
    title: "Enter your journey",
    text: "Pickup, drop-off, date and time, and how many people and bags. An airport or any address in the UK.",
  },
  {
    title: "Pick a vehicle",
    text: "Each vehicle shows its full price, with airport charges and any extras already added. That's what you pay.",
  },
  {
    title: "Book",
    text: "Add your name and mobile number, check the details and book. Your booking reference appears straight away.",
  },
];

export default function HomePage() {
  // The questions customers ask most, from the full FAQ.
  const preview = ["How long will the driver wait?", "What happens if my flight is delayed or early?", "Can I request a child seat?", "Can I cancel or change my booking?", "Which areas do you cover?"];
  const all = faqGroups().flatMap((g) => g.items);
  const faqPreview = preview.flatMap((q) => all.filter((f) => f.q === q));

  return (
    <>
      <JsonLd data={webSite()} />
      {/* Withheld (null) while contact details are placeholders. */}
      <JsonLd data={localBusiness()} />
      <CalculatorHero
        eyebrow="Airport transfers and local rides"
        illustration="london"
        title={
          <>
            Airport taxis and local rides, <span className="text-accent">at a fixed price.</span>
          </>
        }
        lead="To and from Heathrow, Gatwick, Stansted, Luton and London City, or between any two addresses in London and the UK. Enter your journey to see the price for each car."
      >
        <ul className="space-y-3">
          {points.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-white/85">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-700/70 ring-1 ring-white/10">
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
        intro="Pickups and drop-offs at every terminal, from any address in the UK. Prices shown are one way from central London in a saloon."
      >
        <AirportGrid />
      </Section>

      <Section
        id="services"
        eyebrow="Services"
        title="What we do"
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
        intro="Passenger numbers are the most each car takes. Bringing a lot of luggage? Choose an estate or MPV, or ask us first."
      >
        <FleetGrid />
      </Section>

      <Section
        id="app"
        eyebrow="Galaxy Taxi app"
        title="Book faster with our app"
        intro="Add Galaxy Taxi to your phone's home screen and book in a few taps. It's free, takes a few seconds, and always shows our latest prices."
      >
        <div className="flex flex-wrap items-center gap-4">
          <Image src="/app/icon-192.png" alt="Galaxy Taxi app icon" width={56} height={56} className="rounded-2xl shadow-card" />
          <InstallButton tone="onLight" />
          <Link href="/app" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink hover:underline">
            How to install on iPhone and Android
            <Icon name="arrowRight" className="size-4" />
          </Link>
        </div>
      </Section>

      <Section id="faq" tone="surface" eyebrow="FAQ" title="Common questions">
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
