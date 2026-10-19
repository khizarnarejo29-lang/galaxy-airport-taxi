import type { Metadata } from "next";
import { PageHero } from "@/components/sections/blocks";
import { privacyLastUpdated, privacySections } from "@/content/privacy";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Galaxy Airport Taxi collects, uses and protects your personal information when you get a quote or book.",
  path: "/privacy",
});

export default function PrivacyPage() {
  const sections = privacySections();
  return (
    <>
      <PageHero
        crumbs={[{ label: "Privacy Policy", href: "/privacy" }]}
        title="Privacy Policy"
        lead={`How we collect, use and protect your personal information. Last updated ${privacyLastUpdated}.`}
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
              {s.blocks.map((b, i) =>
                typeof b === "string" ? (
                  <p key={i} className="mt-4">
                    {b}
                  </p>
                ) : (
                  <ul key={i} className="mt-4 list-disc space-y-1.5 pl-6 marker:text-accent-strong">
                    {b.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
