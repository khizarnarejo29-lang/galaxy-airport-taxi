import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { CtaBand, PageHero, Section } from "@/components/sections/blocks";
import { Icon } from "@/components/ui/Icon";
import { services } from "@/content/services";

export const metadata: Metadata = pageMetadata({
  title: "Airport Transfer Services",
  description:
    "London airport drop-offs and pickups, Meet & Greet in arrivals and corporate airport transfers. Get a quote online or by phone.",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Services", href: "/services" }]}
        eyebrow="Services"
        illustration="services"
        scene="takeoff"
        title="Our services"
        lead="Airport transfers from anywhere in the UK, local rides between any two addresses, and extras such as Meet & Greet."
      />

      <Section id="services" title="What you can book">
        <ul className="grid gap-4 md:grid-cols-2">
          {services.map((s) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className="group flex h-full gap-5 rounded-3xl border border-line bg-white p-6 transition hover:border-ink-faint hover:shadow-card"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
                  <Icon name={s.icon} className="size-5" />
                </span>
                <span>
                  <span className="block font-display text-xl font-bold">{s.title}</span>
                  <span className="mt-1.5 block leading-relaxed text-ink-soft">{s.summary}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                    Find out more
                    <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand />
    </>
  );
}
