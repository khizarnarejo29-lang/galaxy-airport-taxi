import { afterEach, describe, expect, it, vi } from "vitest";
import { airports } from "@/lib/domain/airports";
import { breadcrumbList, businessId, faqPage, localBusiness, serialiseJsonLd, taxiService, webSite } from "./jsonld";
import { llmsText } from "./llms";
import { pageMetadata } from "./metadata";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("indexing switch", () => {
  it("blocks all crawlers unless SITE_INDEXING=on", async () => {
    const robots = (await import("@/app/robots")).default();
    expect(robots.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(robots.sitemap).toBeUndefined();
  });

  it("allows crawling, hides private routes and lists the sitemap when on", async () => {
    vi.stubEnv("SITE_INDEXING", "on");
    const robots = (await import("@/app/robots")).default();
    expect(robots.rules).toMatchObject({ allow: "/", disallow: ["/api/", "/booking/", "/admin"] });
    expect(robots.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("site address", () => {
  it("defaults to the production domain when NEXT_PUBLIC_SITE_URL is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { site } = await import("@/config/site");
    expect(site.url).toBe("https://galaxyairporttaxi.co.uk");
  });

  it("lets NEXT_PUBLIC_SITE_URL override it", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example");
    const { site } = await import("@/config/site");
    expect(site.url).toBe("https://preview.example");
  });
});

describe("sitemap", () => {
  it("lists every public page and nothing private", async () => {
    const urls = (await import("@/app/sitemap")).default().map((e) => new URL(e.url).pathname);
    for (const a of airports) expect(urls).toContain(`/${a.slug}`);
    expect(urls).toEqual(expect.arrayContaining(["/", "/quote", "/fleet", "/faq", "/contact", "/about", "/services/meet-and-greet", "/privacy", "/terms"]));
    expect(urls.some((u) => u.startsWith("/booking") || u.startsWith("/api") || u.startsWith("/admin"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("structured data", () => {
  it("builds a breadcrumb trail from Home with absolute URLs", () => {
    const data = breadcrumbList([{ label: "Fleet", href: "/fleet" }], "/fleet") as {
      itemListElement: { position: number; name: string; item: string }[];
    };
    expect(data.itemListElement.map((i) => [i.position, i.name])).toEqual([
      [1, "Home"],
      [2, "Fleet"],
    ]);
    expect(data.itemListElement[1].item).toMatch(/^https?:\/\/.+\/fleet$/);
  });

  it("maps FAQs to questions and answers", () => {
    const data = faqPage([{ q: "Q?", a: "A." }]) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(data.mainEntity[0]).toMatchObject({ name: "Q?", acceptedAnswer: { text: "A." } });
  });

  it("describes the business with only the confirmed details", () => {
    expect(localBusiness()).toMatchObject({
      "@type": "LocalBusiness",
      name: "Galaxy Airport Taxi",
      telephone: "+447470046660",
      email: "info@galaxyairporttaxi.co.uk",
      "@id": businessId,
      address: { "@type": "PostalAddress", streetAddress: "4-6 Greatorex Street", addressLocality: "London", postalCode: "E1 5NF", addressCountry: "GB" },
      // 24/7, confirmed by the owner, in schema.org form.
      openingHours: "Mo-Su 00:00-23:59",
    });
  });

  it("escapes < so content can't break out of the script tag", () => {
    expect(serialiseJsonLd({ text: "</script><script>alert(1)</script>" })).not.toContain("<");
  });
});

describe("pageMetadata", () => {
  it("keeps title, canonical and Open Graph in step", () => {
    const m = pageMetadata({ title: "Our Fleet", description: "Vehicles.", path: "/fleet" });
    expect(m.alternates?.canonical).toBe("/fleet");
    expect(m.openGraph).toMatchObject({ url: "/fleet", title: "Our Fleet | Galaxy Airport Taxi", description: "Vehicles." });
  });
});

describe("linked business data", () => {
  it("ties the website and each service to the one business", () => {
    expect(webSite()).toMatchObject({ publisher: { "@id": businessId } });
    const service = taxiService({ name: "Heathrow airport taxi", description: "D", path: "/heathrow-airport-taxi", airport: { name: "Heathrow Airport", iataCode: "LHR" } });
    expect(service).toMatchObject({
      "@type": "TaxiService",
      provider: { "@id": businessId },
      url: "https://galaxyairporttaxi.co.uk/heathrow-airport-taxi",
      areaServed: expect.arrayContaining([{ "@type": "Airport", name: "Heathrow Airport", iataCode: "LHR" }]),
    });
    expect(JSON.stringify(service)).not.toMatch(/rating|review|price/i);
  });
});

describe("llms.txt", () => {
  it("summarises the business from the site's own details", () => {
    const text = llmsText();
    expect(text.startsWith("# Galaxy Airport Taxi\n")).toBe(true);
    expect(text).toContain("+44 7470 046660");
    expect(text).toContain("Child seats: free of charge.");
    for (const a of airports) expect(text).toContain(`https://galaxyairporttaxi.co.uk/${a.slug}`);
    expect(text).not.toMatch(/admin|\/api\//);
  });
});

describe("installable app", () => {
  it("has a manifest with any and maskable icons and shortcuts", async () => {
    const manifest = (await import("@/app/manifest")).default();
    expect(manifest).toMatchObject({ display: "standalone", start_url: "/", scope: "/" });
    expect(manifest.icons?.map((i) => i.purpose)).toEqual(expect.arrayContaining(["any", "maskable"]));
    expect(manifest.icons?.some((i) => i.sizes === "192x192")).toBe(true);
    expect(manifest.shortcuts?.map((s) => s.url)).toEqual(["/quote", "/taxi"]);
  });

  it("lists the app page in the sitemap, but not the offline page", async () => {
    const { indexablePaths } = await import("@/config/seo");
    expect(indexablePaths()).toContain("/app");
    expect(indexablePaths()).not.toContain("/offline");
  });
});
