import { afterEach, describe, expect, it } from "vitest";
import { airports } from "@/lib/domain/airports";
import { validateContact } from "@/lib/domain/contact";
import { airportContent } from "./airports";
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
    for (const required of ["Galaxy Airport Taxi", "4-6 Greatorex Street, London E1 5NF", "info@galaxyairporttaxi.co.uk", "+44 7470 046660"]) {
      expect(text).toContain(required);
    }
  });
});
