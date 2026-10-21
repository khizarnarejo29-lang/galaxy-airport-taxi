import { legalNav, mainNav, isGroup } from "@/config/navigation";
import { areas } from "@/content/areas";

/**
 * Search-engine visibility. OFF unless SITE_INDEXING=on is set, so previews and
 * pre-launch deployments can never be indexed by accident. Turn it on at launch only.
 */
export const indexingEnabled = process.env.SITE_INDEXING === "on";

/** Pages listed in the sitemap: the homepage, the quote page, the main navigation and the legal pages. */
export function indexablePaths(): string[] {
  const navPaths = mainNav.flatMap((item) => (isGroup(item) ? item.children.map((c) => c.href) : [item.href]));
  // The privacy policy and terms are real pages now, so they are listed too.
  const areaPaths = areas.map((a) => `/taxi/${a.slug}`);
  return [...new Set(["/", "/quote", ...navPaths, ...areaPaths, ...legalNav.map((l) => l.href)])];
}
