import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { CtaBand, FaqList, NumberedSteps, PageHero, Section } from "@/components/sections/blocks";
import { meetAndGreet } from "@/content/services";

export const metadata: Metadata = pageMetadata({
  title: "Meet and Greet Airport Transfers",
  description:
    "Add Meet & Greet to your London airport pickup and find your driver waiting in the arrivals hall with your name. Book online.",
  path: "/services/meet-and-greet",
});

const faqs = [
  {
    q: "Which journeys can I add Meet & Greet to?",
    a: "Meet & Greet is available on pickups from any of the five London airports. It doesn't apply to drop-offs.",
  },
  {
    q: "How do I add it?",
    a: "Choose “From the airport” in the calculator. Meet & Greet appears in the extras section before you review your booking, with its cost shown.",
  },
  {
    q: "What do I need to give you?",
    a: "Your flight number and scheduled landing time, which the calculator asks for on every airport pickup.",
  },
];

export default function MeetAndGreetPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Services", href: "/services" }, { label: "Meet & Greet", href: "/services/meet-and-greet" }]}
        eyebrow="Meet & Greet"
        title="Find your driver as soon as you land"
        lead={meetAndGreet.description}
      />

      <Section id="how" eyebrow="How it works" title="Three simple steps">
        <NumberedSteps steps={meetAndGreet.steps} />
      </Section>

      <Section id="faq" tone="surface" eyebrow="Questions" title="Meet & Greet FAQs">
        <div className="max-w-3xl">
          <FaqList items={faqs} />
        </div>
      </Section>

      <CtaBand title="Book a pickup with Meet & Greet" text="Choose “From the airport” and add Meet & Greet in the extras step." />
    </>
  );
}
