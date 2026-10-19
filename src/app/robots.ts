import type { MetadataRoute } from "next";
import { indexingEnabled } from "@/config/seo";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  // Pre-launch: ask all crawlers to stay away entirely.
  if (!indexingEnabled) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/booking/", "/admin"] },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
