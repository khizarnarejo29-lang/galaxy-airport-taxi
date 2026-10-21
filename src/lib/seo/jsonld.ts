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

/** Stable ids, so every page's structured data points at the same business. */
export const businessId = absolute("/#business");
const websiteId = absolute("/#website");

export function webSite(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    name: site.name,
    url: absolute("/"),
    inLanguage: "en-GB",
    ...(site.isPlaceholder ? {} : { publisher: { "@id": businessId } }),
  };
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
    "@id": businessId,
    name: site.name,
    url: absolute("/"),
    logo: absolute("/brand/logo.png"),
    image: absolute("/opengraph-image"),
    telephone: site.phone.href.replace(/^tel:/, ""),
    email: site.email,
    areaServed: { "@type": "Country", name: "United Kingdom" },
    ...(site.postalAddress
      ? { address: { "@type": "PostalAddress", ...site.postalAddress } }
      : site.address
        ? { address: site.address }
        : {}),
    ...(site.openingHoursSchema ? { openingHours: site.openingHoursSchema } : {}),
  };
}

interface TaxiServiceInput {
  name: string;
  description: string;
  /** Path of the page describing the service. */
  path: string;
  /** For an airport page: the airport served. */
  airport?: { name: string; iataCode: string };
  /** For an area page: the place served, e.g. "Croydon, London". */
  place?: string;
}

/**
 * One service the business offers, as described on its page. Linked to the
 * business by id; no prices or ratings are included.
 */
export function taxiService({ name, description, path, airport, place }: TaxiServiceInput): JsonLdObject | null {
  if (site.isPlaceholder) return null;
  return {
    "@context": "https://schema.org",
    "@type": "TaxiService",
    name,
    description,
    url: absolute(path),
    provider: { "@id": businessId },
    areaServed: airport
      ? [{ "@type": "Airport", name: airport.name, iataCode: airport.iataCode }, { "@type": "Country", name: "United Kingdom" }]
      : place
        ? [{ "@type": "Place", name: place }, { "@type": "Country", name: "United Kingdom" }]
        : { "@type": "Country", name: "United Kingdom" },
  };
}

/** Serialise for a <script type="application/ld+json">, escaping "<" against injection. */
export function serialiseJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
