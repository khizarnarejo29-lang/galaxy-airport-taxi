import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

/** Shown by the app's service worker when there is no connection. Static, so it can be saved for offline use. */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent-soft text-accent-strong">
        <Icon name="alert" className="size-6" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">You&apos;re offline</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-soft">
        Check your internet connection and try again. To book or ask about a journey now, call or WhatsApp us.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href={site.phone.href} className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 font-bold text-white">
          <Icon name="phone" className="size-4" />
          Call {site.phone.display}
        </a>
        {site.whatsapp && (
          <a href={site.whatsapp.href} className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-5 font-bold text-ink">
            <Icon name="chat" className="size-4" />
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
