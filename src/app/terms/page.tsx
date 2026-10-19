import type { Metadata } from "next";
import { PageHero } from "@/components/sections/blocks";
import { termsLastUpdated, termsSections } from "@/content/terms";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Terms and Conditions",
  description: "Booking terms for Galaxy Airport Taxi: prices, waiting time, flight delays, cancellations and refunds.",
  path: "/terms",
});

export default function TermsPage() {
  const sections = termsSections();
  return (
    <>
      <PageHero
        crumbs={[{ label: "Terms and Conditions", href: "/terms" }]}
        title="Terms and Conditions"
        lead={`The terms for every journey you book with us. Last updated ${termsLastUpdated}.`}
        actions={false}
      />
      <div className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-lg leading-relaxed text-ink-soft sm:px-6">
          <nav aria-label="On this page" className="mb-12 rounded-3xl border border-line bg-surface p-6">
            <h2 className="text-sm font-bold tracking-wider text-ink uppercase">On this page</h2>
            <ol className="mt-3 grid gap-1.5 text-base sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-ink underline-offset-2 hover:underline">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="mb-12 scroll-mt-20">
              <h2 id={`${s.id}-heading`} className="font-display text-2xl font-bold tracking-tight text-ink">
                {s.title}
              </h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="mt-4">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
