import type { Metadata } from "next";
import { InstallButton } from "@/components/app/InstallButton";
import { CtaBand, FeatureCard, PageHero, Section } from "@/components/sections/blocks";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Galaxy Taxi App",
  description:
    "Add the Galaxy Airport Taxi app to your phone's home screen: book airport transfers and local rides in a few taps, on iPhone and Android. Free.",
  path: "/app",
});

export default function AppPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "App", href: "/app" }]}
        eyebrow="Galaxy Taxi app"
        illustration="london"
        title="Our app, on your home screen"
        lead="Install Galaxy Taxi on your phone in a few seconds. It opens full screen like any other app, and it's always up to date because it runs our live booking system. No app store needed, and it's free."
        actions={false}
      >
        <div className="mt-8">
          <InstallButton />
        </div>
      </PageHero>

      <Section id="how" eyebrow="How to install" title="Two taps on iPhone or Android">
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard icon="phone" title="iPhone (Safari)">
            Open galaxyairporttaxi.co.uk in Safari, tap the Share button (the square with an arrow), then choose
            &ldquo;Add to Home Screen&rdquo; and tap &ldquo;Add&rdquo;.
          </FeatureCard>
          <FeatureCard icon="phone" title="Android (Chrome)">
            Tap &ldquo;Install the app&rdquo; above if you see it. Otherwise open the menu (three dots) and choose
            &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.
          </FeatureCard>
        </div>
      </Section>

      <Section id="why" tone="surface" eyebrow="In the app" title="Everything the website does">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon="route" title="Instant fixed prices">
            Airport transfers, airport to airport and local rides, with the price for every vehicle before you book.
          </FeatureCard>
          <FeatureCard icon="check" title="Book in minutes">
            The same booking as the website, with your booking reference straight away.
          </FeatureCard>
          <FeatureCard icon="chat" title="Call or WhatsApp">
            One tap to call or message us, 24 hours a day.
          </FeatureCard>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
