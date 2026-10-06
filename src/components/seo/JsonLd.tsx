import { serialiseJsonLd } from "@/lib/seo/jsonld";

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }} />;
}
