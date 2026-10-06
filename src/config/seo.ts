import { mainNav, isGroup } from "@/config/navigation";

/**
 * Search-engine visibility. OFF unless SITE_INDEXING=on is set, so previews and
 * pre-launch deployments can never be indexed by accident. Turn it on at launch only.
 */
export const indexingEnabled = process.env.SITE_INDEXING === "on";

/** Pages listed in the sitemap: the homepage, the quote page and everything in the main navigation. */
export function indexablePaths(): string[] {
  const navPaths = mainNav.flatMap((item) => (isGroup(item) ? item.children.map((c) => c.href) : [item.href]));
  return [...new Set(["/", "/quote", ...navPaths])];
}
