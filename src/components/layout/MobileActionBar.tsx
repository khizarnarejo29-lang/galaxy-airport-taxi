"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { QuoteLink } from "./QuoteLink";

/**
 * Fixed Call / Get a Quote bar for phones, on every page except bookings and
 * admin. It sits after the footer so it never hides content, and the
 * calculator's own action bar sits just above it (--mobile-bar-height).
 */
export function MobileActionBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/booking/") || pathname.startsWith("/admin")) return null;

  return (
    <>
      <div className="h-[4.5rem] bg-night lg:hidden" aria-hidden="true" />
      <nav
        aria-label="Call or get a quote"
        data-mobile-bar
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(11_26_51/0.25)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-md gap-3">
          <a
            href={site.phone.href}
            aria-label={`Call ${site.phone.display}`}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-line font-bold whitespace-nowrap text-ink tabular-nums transition-colors hover:border-ink"
          >
            <Icon name="phone" className="size-4 shrink-0" />
            {site.phone.display}
          </a>
          <QuoteLink
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-ink font-bold whitespace-nowrap text-white transition hover:bg-night-3"
          >
            Get a Quote
          </QuoteLink>
        </div>
      </nav>
    </>
  );
}
