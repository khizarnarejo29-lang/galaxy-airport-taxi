import type { ReactNode } from "react";
import { PageHero } from "./blocks";
import { site } from "@/config/site";

/**
 * Pre-launch placeholder for legal pages. The business must supply its own
 * privacy policy and terms; they are required before running Google Ads.
 * Any sections already confirmed are passed as children and shown first.
 */
export function LegalPlaceholder({ title, path, children }: { title: string; path: string; children?: ReactNode }) {
  return (
    <>
      <PageHero
        crumbs={[{ label: title, href: path }]}
        title={title}
        lead={children ? "Some sections of this page are still being prepared." : "This page is being prepared."}
        actions={false}
      />
      <div className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-lg leading-relaxed text-ink-soft sm:px-6">
          {children}
          <p>
            {children ? `The rest of our ${title.toLowerCase()}` : `Our ${title.toLowerCase()}`} will be published here. In the
            meantime, if you have a question, email{" "}
            <a href={`mailto:${site.email}`} className="font-semibold text-ink underline">
              {site.email}
            </a>
            .
          </p>
        </div>
      </div>
    </>
  );
}
