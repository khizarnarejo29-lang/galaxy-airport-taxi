import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FaqList, PageHero, RelatedLinks, Section } from "@/components/sections/blocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqGroups } from "@/content/faqs";
import { faqPage } from "@/lib/seo/jsonld";

export const metadata: Metadata = pageMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers about London airport transfer quotes, prices, airport charges, booking notice, flight numbers, extra stops and child seats.",
  path: "/faq",
});

export default function FaqPage() {
  const groups = faqGroups();
  return (
    <>
      {/* Every question and answer below is visible on the page, so FAQPage markup is accurate. */}
      <JsonLd data={faqPage(groups.flatMap((g) => g.items))} />
      <PageHero
        crumbs={[{ label: "FAQ", href: "/faq" }]}
        eyebrow="FAQ"
        illustration="faq"
        title="Questions and answers"
        lead="How quotes work, what's included and what to expect when you book."
      />
      <div className="bg-white">
        <div className="mx-auto max-w-3xl space-y-14 px-4 py-16 sm:px-6 sm:py-20">
          {groups.map((g, i) => (
            <section key={g.title} aria-labelledby={`faq-group-${i}`}>
              <h2 id={`faq-group-${i}`} className="mb-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {g.title}
              </h2>
              <FaqList items={g.items} />
            </section>
          ))}
        </div>
      </div>
      <Section id="related" tone="surface" eyebrow="More help" title="Still deciding?">
        <RelatedLinks
          links={[
            { href: "/prices", title: "Prices", text: "Fixed prices from across London to all five airports." },
            { href: "/fleet", title: "Our fleet", text: "Which vehicle fits your group and luggage." },
            { href: "/services/meet-and-greet", title: "Meet & Greet", text: "Your driver meets you inside the arrivals hall." },
            { href: "/contact", title: "Contact us", text: "Call, WhatsApp or email, 24 hours a day." },
          ]}
        />
      </Section>
      <CtaBand />
    </>
  );
}
