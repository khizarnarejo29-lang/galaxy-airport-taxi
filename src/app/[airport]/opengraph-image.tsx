import { airportContent } from "@/content/airports";
import { airports } from "@/lib/domain/airports";
import { ogSize, renderOgImage } from "@/lib/seo/og-image";

export const size = ogSize;
export const contentType = "image/png";

export function generateStaticParams() {
  return airports.map((a) => ({ airport: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ airport: string }> }) {
  const { airport: slug } = await params;
  const airport = airports.find((a) => a.slug === slug) ?? airports[0];
  return renderOgImage({ eyebrow: `${airport.name} transfers`, title: airportContent[airport.code].metaTitle });
}
