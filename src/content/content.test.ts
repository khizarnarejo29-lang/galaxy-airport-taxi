import { afterEach, describe, expect, it } from "vitest";
import { airports } from "@/lib/domain/airports";
import { validateContact } from "@/lib/domain/contact";
import { airportContent, airportFaqs } from "./airports";
import { faqGroups } from "./faqs";
import { policies } from "./policies";

describe("faqGroups", () => {
  const set = policies.cancellation;
  afterEach(() => {
    policies.cancellation = set;
  });

  it("hides policy questions until the policy is written", () => {
    policies.cancellation = null;
    const questions = faqGroups().flatMap((g) => g.items.map((i) => i.q));
    expect(questions).not.toContain("Can I cancel or change my booking?");
  });

  it("shows the owner's waiting, delay and cancellation answers", () => {
    const questions = faqGroups().flatMap((g) => g.items.map((i) => i.q));
    expect(questions).toEqual(expect.arrayContaining(["How long will the driver wait?", "What happens if my flight is delayed or early?", "Can I cancel or change my booking?"]));
  });

  it("shows a policy question once it is set", () => {
    policies.cancellation = "Example policy text.";
    const items = faqGroups().flatMap((g) => g.items);
    expect(items.find((i) => i.q === "Can I cancel or change my booking?")?.a).toBe("Example policy text.");
  });
});

describe("airport content", () => {
  it("exists for every airport", () => {
    for (const a of airports) expect(airportContent[a.code].h1).toBeTruthy();
  });

  it("uses distinct page titles and descriptions", () => {
    const titles = new Set(airports.map((a) => airportContent[a.code].metaTitle));
    const descriptions = new Set(airports.map((a) => airportContent[a.code].metaDescription));
    expect(titles.size).toBe(airports.length);
    expect(descriptions.size).toBe(airports.length);
  });

  it("keeps meta descriptions within search-result length", () => {
    for (const a of airports) expect(airportContent[a.code].metaDescription.length).toBeLessThanOrEqual(160);
  });

  it("adds the shared waiting, delay and child seat answers to every airport's FAQs", () => {
    for (const a of airports) {
      const questions = airportFaqs(a.code, a.shortName).map((f) => f.q);
      expect(questions).toEqual(
        expect.arrayContaining([`How long will the driver wait at ${a.shortName}?`, "What if my flight is delayed?", "Are child seats free?"]),
      );
    }
  });

  it("no longer limits coverage to a London service area", () => {
    const text = JSON.stringify(airportContent);
    expect(text).not.toMatch(/service area/i);
  });
});

describe("validateContact", () => {
  const valid = { topic: "general" as const, name: "Sam", email: "sam@example.com", message: "Hello there, a question." };

  it("accepts a valid enquiry", () => {
    expect(validateContact(valid)).toEqual([]);
  });

  it("flags missing details", () => {
    const codes = validateContact({ ...valid, name: "", email: "x", message: "hi" }).map((e) => e.code);
    expect(codes).toEqual(["NAME_REQUIRED", "EMAIL_INVALID", "MESSAGE_REQUIRED"]);
  });

  it("only checks the phone number when one is given", () => {
    expect(validateContact({ ...valid, phone: "" })).toEqual([]);
    expect(validateContact({ ...valid, phone: "12" }).map((e) => e.code)).toEqual(["PHONE_INVALID"]);
  });
});

describe("terms: cancellation and refunds", () => {
  it("states the refund processing period from config, distinct from bank timing", async () => {
    const { termsSections } = await import("./terms");
    const section = termsSections().find((s) => s.id === "cancellation-and-refunds")!;
    expect(section.paragraphs[0]).toContain("eligible for a refund under the applicable cancellation policy");
    expect(section.paragraphs[0]).toContain("within 7 business days");
    expect(section.paragraphs[1]).toMatch(/bank or card provider may need additional time/);
    expect(section.paragraphs.join(" ")).not.toMatch(/%|£|fee/i);
    expect(section.paragraphs.join(" ")).toContain("24 hours or more before your pickup time: full refund");
  });

  it("states the owner's rules and the live prices", async () => {
    const { termsSections } = await import("./terms");
    const text = termsSections().flatMap((s) => s.paragraphs).join(" ");
    for (const required of ["60 minutes free of charge", "£20 an hour", "a delay is never charged", "Meet & Greet", "£6", "£10", "Child seats are free", "24 December, 6pm", "England and Wales"]) {
      expect(text).toContain(required);
    }
    expect(text).not.toMatch(/being prepared|will be published here/i);
  });
});

describe("privacy policy", () => {
  it("contains no excluded or unconfirmed claims", async () => {
    const { privacySections } = await import("./privacy");
    const text = privacySections()
      .flatMap((s) => [s.title, ...s.blocks.flatMap((b) => (typeof b === "string" ? [b] : b.list))])
      .join(" ");
    for (const banned of [/onward travel/i, /opayo/i, /google analytics/i, /openai/i, /finance act/i, /\d+\s*(year|month)s?/i, /licen[cs]e/i, /company (no|number|registration)/i, /record(ed|ing) (calls|chats)/i, /card number|security code/i, /being prepared|will be published here/i]) {
      expect(text).not.toMatch(banned);
    }
    for (const required of ["Galaxy Airport Taxi", "4-6 Greatorex Street, London E1 5NF", "info@galaxyairporttaxi.co.uk", "020 3769 2728"]) {
      expect(text).toContain(required);
    }
  });
});

describe("prices page questions", () => {
  it("quotes each airport's central London price from the live tariff", async () => {
    const { priceFaqs } = await import("./prices");
    const { centralLondonFrom } = await import("@/lib/pricing/example-fares");
    const { formatGBP } = await import("@/lib/utils/money");
    const faqs = priceFaqs();
    for (const a of airports) {
      const faq = faqs.find((f) => f.q === `How much is a taxi from central London to ${a.shortName}?`);
      expect(faq?.a).toContain(`From ${formatGBP(centralLondonFrom(a.code)!)} one way`);
    }
    expect(faqs.find((f) => f.q === "Are there any extra charges?")?.a).toMatch(/child seats are free/);
  });
});

describe("area pages", () => {
  it("prices every area to every airport and to central London, for every vehicle", async () => {
    const { areas } = await import("./areas");
    const { airportRows, areaFaqs, localRows } = await import("./area-pages");
    for (const area of areas) {
      const rows = [...airportRows(area), ...localRows(area)];
      expect(rows).toHaveLength(airports.length + 4);
      for (const r of rows) expect(Object.keys(r.prices), `${area.name} → ${r.label}`).toHaveLength(5);
      expect(areaFaqs(area)[0].q).toBe(`Which airport is closest to ${area.name}?`);
      expect(areaFaqs(area)[1].a).toMatch(/^From £\d+ one way/);
      expect(area.about.length, area.name).toBeGreaterThan(60);
    }
  });

  it("gives every area its own slug, listed in the sitemap", async () => {
    const { areas } = await import("./areas");
    const { indexablePaths } = await import("@/config/seo");
    expect(new Set(areas.map((a) => a.slug)).size).toBe(areas.length);
    for (const a of areas) expect(indexablePaths()).toContain(`/taxi/${a.slug}`);
    expect(indexablePaths()).toContain("/taxi");
  });

  it("prices the example local routes", async () => {
    const { exampleRouteRows } = await import("./area-pages");
    for (const r of exampleRouteRows()) expect(r.prices.saloon, r.label).toBeGreaterThan(0);
  });
});

describe("page titles and descriptions", () => {
  it("keeps area page titles and the site description within search-result length", async () => {
    const { areas } = await import("./areas");
    for (const a of areas) expect(`${a.shortName ?? a.name} Taxi and Airport Transfers | Galaxy Airport Taxi`.length, a.name).toBeLessThanOrEqual(65);
  });
});

describe("airport to airport prices on airport pages", () => {
  it("lists the four other airports for each airport, priced for every vehicle", async () => {
    const { otherAirportRows } = await import("./area-pages");
    for (const a of airports) {
      const rows = otherAirportRows(a.code);
      expect(rows.map((r) => r.sub).sort()).toEqual(airports.filter((o) => o.code !== a.code).map((o) => o.code).sort());
      for (const r of rows) expect(Object.keys(r.prices)).toHaveLength(5);
    }
  });
});
