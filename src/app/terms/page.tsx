import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/sections/LegalPlaceholder";
import { termsSections } from "@/content/terms";

export const metadata: Metadata = { title: "Terms and Conditions", robots: { index: false } };

export default function TermsPage() {
  return (
    <LegalPlaceholder title="Terms and conditions" path="/terms">
      {termsSections().map((s) => (
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
    </LegalPlaceholder>
  );
}
