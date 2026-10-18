import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/config/site";
import { breadcrumbList } from "@/lib/seo/jsonld";
import { PageIllustration, type IllustrationName } from "./PageIllustration";
import { RoadSkyline, type RoadScene } from "./RoadSkyline";

/* Shared building blocks for content pages. Server components: no client JS. */

export const container = "mx-auto max-w-6xl px-4 sm:px-6";

/** Soft navy glow behind dark bands; pure CSS so there is no image to load. */
export function NavyGlow() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(60rem 30rem at 85% -10%, rgb(63 95 149 / 0.45), transparent 60%)," +
          "radial-gradient(40rem 24rem at -10% 110%, rgb(36 70 126 / 0.35), transparent 60%)",
      }}
    />
  );
}

export interface Crumb {
  label: string;
  href: string;
}

/** Visible breadcrumb trail plus matching BreadcrumbList structured data. The last item is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const current = items[items.length - 1];
  return (
    <nav aria-label="Breadcrumb">
      <JsonLd data={breadcrumbList(items, current.href)} />
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
        <li>
          <Link href="/" className="hover:text-white">
            Home
          </Link>
        </li>
        {items.map((c) => (
          <li key={c.href} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            {c !== current ? (
              <Link href={c.href} className="hover:text-white">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-white/85">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface PageHeroProps {
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  lead: string;
  /** Show the Get a Quote / Call buttons. */
  actions?: boolean;
  /** Picture of the page's subject: beside the text on desktop, below it on phones. */
  illustration?: IllustrationName;
  scene?: RoadScene;
  children?: ReactNode;
}

export function PageHero({ crumbs, eyebrow, title, lead, actions = true, illustration, scene, children }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-night text-white">
      <RoadSkyline compact scene={scene} />
      <div
        className={`${container} pt-8 pb-24 sm:pt-10 sm:pb-28 lg:pb-32 ${
          illustration ? "grid gap-10 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:gap-14" : ""
        }`}
      >
        <div>
          <Breadcrumbs items={crumbs} />
          {eyebrow && <p className="mt-8 text-sm font-bold tracking-wider text-accent uppercase">{eyebrow}</p>}
          <h1
            className={`${eyebrow ? "mt-3" : "mt-8"} max-w-3xl font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl`}
          >
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{lead}</p>
          {actions && <HeroActions />}
          {children}
        </div>
        {illustration && (
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <PageIllustration name={illustration} />
          </div>
        )}
      </div>
    </section>
  );
}

export function HeroActions({ quoteHref = "/quote" }: { quoteHref?: string }) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href={quoteHref}
        className="inline-flex h-13 items-center gap-2 rounded-xl bg-white px-6 font-bold text-ink transition hover:bg-navy-100"
      >
        Get a Quote
        <Icon name="arrowRight" className="size-5" />
      </Link>
      <a
        href={site.phone.href}
        className="inline-flex h-13 items-center gap-2 rounded-xl border-2 border-white/25 px-6 font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
      >
        <Icon name="phone" className="size-4" />
        {site.phone.display}
      </a>
    </div>
  );
}

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  tone?: "white" | "surface";
  children: ReactNode;
}

export function Section({ id, eyebrow, title, intro, tone = "white", children }: SectionProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={tone === "surface" ? "bg-surface" : "bg-white"}>
      <div className={`${container} py-16 sm:py-20`}>
        {eyebrow && <p className="text-sm font-bold tracking-wider text-accent-strong uppercase">{eyebrow}</p>}
        <h2
          id={headingId}
          className="mt-2 max-w-3xl font-display text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl"
        >
          {title}
        </h2>
        {intro && <div className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">{intro}</div>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export function FeatureCard({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-6">
      <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
        <Icon name={icon} className="size-5" />
      </span>
      <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
      <div className="mt-2 leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

export function NumberedSteps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="rounded-3xl border border-line bg-white p-6">
          <span className="font-display text-4xl font-extrabold text-accent">{String(i + 1).padStart(2, "0")}</span>
          <h3 className="mt-3 font-display text-xl font-bold">{s.title}</h3>
          <p className="mt-2 leading-relaxed text-ink-soft">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** Accessible FAQ list using native <details>; works without JavaScript. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
      {items.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 font-semibold sm:px-6 [&::-webkit-details-marker]:hidden">
            <span>{f.q}</span>
            <Icon name="plus" className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-45" />
          </summary>
          <p className="px-5 pb-5 leading-relaxed text-ink-soft sm:px-6">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({
  title = "Get a price for your journey",
  text = "Enter your route, date and passengers. Where we can price it online you'll see a fixed total before you book; otherwise call us for a price.",
  quoteHref = "/quote",
}: {
  title?: string;
  text?: string;
  quoteHref?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-night text-white">
      <NavyGlow />
      <div className={`${container} flex flex-col gap-6 py-16 md:flex-row md:items-center md:justify-between`}>
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-3 text-lg text-white/75">{text}</p>
        </div>
        <HeroActions quoteHref={quoteHref} />
      </div>
    </section>
  );
}
