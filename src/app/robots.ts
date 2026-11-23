import type { MetadataRoute } from "next";
import { indexingEnabled } from "@/config/seo";
import { site } from "@/config/site";

/** Pages that are private or useless in search: bookings, the admin area and the API. */
const PRIVATE = ["/api/", "/booking/", "/admin"];

/**
 * AI assistants and AI search crawlers, named so they are plainly welcome
 * (the general rule already allows them; some checks look for them by name).
 */
export const aiCrawlers = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
  "MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
  // Pre-launch: ask all crawlers to stay away entirely.
  if (!indexingEnabled) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: aiCrawlers, allow: "/", disallow: PRIVATE },
    ],
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
