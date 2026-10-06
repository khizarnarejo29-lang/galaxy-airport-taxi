import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { ContactForm } from "@/components/contact/ContactForm";
import { PageHero } from "@/components/sections/blocks";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { contactTopics, type ContactTopic } from "@/lib/domain/contact";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Contact Galaxy Airport Taxi by phone, email or online form about London airport transfers and business travel.",
  path: "/contact",
});

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const { topic } = await searchParams;
  const initialTopic = typeof topic === "string" && topic in contactTopics ? (topic as ContactTopic) : "general";

  const channels = [
    { icon: "phone" as const, label: "Phone", value: site.phone.display, href: site.phone.href },
    { icon: "mail" as const, label: "Email", value: site.email, href: `mailto:${site.email}` },
    ...(site.whatsapp ? [{ icon: "phone" as const, label: "WhatsApp", value: site.whatsapp.display, href: site.whatsapp.href }] : []),
  ];

  return (
    <>
      <PageHero
        crumbs={[{ label: "Contact", href: "/contact" }]}
        eyebrow="Contact"
        title="Get in touch"
        lead="For a price, the quickest route is the online calculator. For anything else, including changes to a booking or business enquiries, contact us here."
      />
      <div className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="flex items-center gap-4 rounded-3xl border border-line bg-white p-5 transition hover:border-ink-faint"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
                  <Icon name={c.icon} className="size-5" />
                </span>
                <span>
                  <span className="block text-sm text-ink-soft">{c.label}</span>
                  <span className="block font-semibold break-all">{c.value}</span>
                </span>
              </a>
            ))}
            {site.openingHours && (
              <p className="rounded-3xl border border-line bg-white p-5 text-sm text-ink-soft">
                <span className="block font-semibold text-ink">Opening hours</span>
                {site.openingHours}
              </p>
            )}
            {site.address && (
              <p className="rounded-3xl border border-line bg-white p-5 text-sm text-ink-soft">
                <span className="block font-semibold text-ink">Address</span>
                {site.address}
              </p>
            )}
          </div>
          <div className="relative">
            <h2 className="sr-only">Send us a message</h2>
            <ContactForm initialTopic={initialTopic} />
          </div>
        </div>
      </div>
    </>
  );
}
