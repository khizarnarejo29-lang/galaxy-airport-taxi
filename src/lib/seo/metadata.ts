import type { Metadata } from "next";
import { site } from "@/config/site";

/**
 * Site-wide preview image (app/opengraph-image.tsx). A page's own Open Graph block
 * replaces the inherited one, so the image is always listed explicitly.
 */
const defaultImage = { url: "/opengraph-image", width: 1200, height: 630, alt: `${site.name}: London airport transfers` };

interface PageMetaInput {
  /** Page title without the brand; the layout template appends it. */
  title: string;
  description: string;
  /** Path of the page, e.g. "/fleet". Used for the canonical URL and Open Graph. */
  path: string;
  /** A page-specific preview image route, e.g. "/heathrow-airport-taxi/opengraph-image". */
  image?: { url: string; alt: string };
}

/**
 * Consistent metadata for every content page. Next.js doesn't derive Open Graph
 * tags from the page title, so they're set here alongside it.
 */
export function pageMetadata({ title, description, path, image }: PageMetaInput): Metadata {
  const fullTitle = `${title} | ${site.name}`;
  const ogImage = image ? { ...defaultImage, ...image } : defaultImage;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_GB",
      url: path,
      title: fullTitle,
      description,
      images: [ogImage],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [ogImage.url] },
  };
}
