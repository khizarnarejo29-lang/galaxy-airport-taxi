import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { taxiService } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { CtaBand, PageHero, Section } from "@/components/sections/blocks";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { corporateTopics } from "@/content/services";

const description =
  "Airport transfers for businesses in London: staff and client travel, recurring trips and corporate account enquiries.";

export const metadata: Metadata = pageMetadata({
  title: "Corporate Airport Transfers",
  description,
  path: "/services/corporate-travel",
});

export default function CorporateTravelPage() {
  return (
    <>
      <JsonLd data={taxiService({ name: "Corporate airport transfers", description, path: "/services/corporate-travel" })} />
      <PageHero
        crumbs={[{ label: "Services", href: "/services" }, { label: "Corporate Travel", href: "/services/corporate-travel" }]}
        eyebrow="Corporate travel"
        illustration="corporate"
        title="Airport transfers for your business"
        lead="Book airport transfers and other journeys for yourself, colleagues or visiting clients, or ask us about an account for your company."
        actions={false}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/contact?topic=corporate"
            className="inline-flex h-13 items-center gap-2 rounded-xl bg-white px-6 font-bold text-ink transition hover:bg-navy-100"
          >
            Make a business enquiry
            <Icon name="arrowRight" className="size-5" />
          </Link>
          <Link
            href="/quote"
            className="inline-flex h-13 items-center rounded-xl border-2 border-white/25 px-6 font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
          >
            Get a Quote
          </Link>
        </div>
      </PageHero>

      <Section id="topics" eyebrow="For businesses" title="What we can help with">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {corporateTopics.map((t) => (
            <li key={t.title} className="rounded-3xl border border-line bg-white p-6">
              <Icon name="check" className="size-5 text-accent-strong" />
              <h3 className="mt-4 font-display text-xl font-bold">{t.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{t.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="booking-for-others"
        tone="surface"
        eyebrow="Booking for someone else"
        title="Booking on behalf of a colleague or client"
        intro="Enter the traveller's name and mobile number as the lead passenger so the driver can reach them on the day. The booking reference is shown on the confirmation page for your records."
      >
        <p className="text-ink-soft">
          For several journeys at once, or anything the online calculator doesn&apos;t cover, email{" "}
          <a href={`mailto:${site.email}`} className="font-semibold text-ink underline">
            {site.email}
          </a>{" "}
          or call{" "}
          <a href={site.phone.href} className="font-semibold text-ink underline">
            {site.phone.display}
          </a>
          .
        </p>
      </Section>

      <CtaBand title="Get a price for a business trip" />
    </>
  );
}
