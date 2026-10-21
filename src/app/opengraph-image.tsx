import { site } from "@/config/site";
import { ogSize, renderOgImage } from "@/lib/seo/og-image";

export const alt = `${site.name}: London airport transfers`;
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage({ eyebrow: "Airport transfers and local rides", title: "Airport taxis at a fixed price." });
}
