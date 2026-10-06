/**
 * Structured data (schema.org JSON-LD). Only types that describe real, visible
 * content are produced. Business details are withheld while they're placeholders,
 * and there is no Review or AggregateRating markup.
 */
import { site } from "@/config/site";

type JsonLdObject = Record<string, unknown>;

const absolute = (path: string) => new URL(path, site.url).toString();

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Breadcrumb trail as shown on the page, starting from Home. */
export function breadcrumbList(items: BreadcrumbItem[], currentPath: string): JsonLdObject {
  const trail = [{ label: "Home", href: "/" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: absolute(c.href ?? currentPath),
    })),
  };
}

/** For pages whose main content is a list of questions and answers shown in full. */
export function faqPage(items: { q: string; a: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function webSite(): JsonLdObject {
  return { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: absolute("/") };
}

/**
 * The business itself. Returns null until real contact details replace the
 * placeholders, so search engines never receive a fake phone number or email.
 */
export function localBusiness(): JsonLdObject | null {
  if (site.isPlaceholder) return null;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.name,
    url: absolute("/"),
    telephone: site.phone.href.replace(/^tel:/, ""),
    email: site.email,
    areaServed: { "@type": "City", name: "London" },
    ...(site.address ? { address: site.address } : {}),
    ...(site.openingHours ? { openingHours: site.openingHours } : {}),
  };
}

/** Serialise for a <script type="application/ld+json">, escaping "<" against injection. */
export function serialiseJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
