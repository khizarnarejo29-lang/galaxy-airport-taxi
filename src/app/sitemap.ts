import type { MetadataRoute } from "next";
import { indexablePaths } from "@/config/seo";
import { site } from "@/config/site";

/**
 * XML sitemap of the public pages. No lastModified/priority values are invented:
 * search engines largely ignore them, and made-up dates would be misleading.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths().map((path) => ({ url: new URL(path, site.url).toString() }));
}
