"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { airports } from "@/lib/domain/airports";

/** Pages that already show the calculator (with its own action bar) or don't need one. */
const HIDDEN = new Set(["/", "/quote", ...airports.map((a) => `/${a.slug}`)]);

/** Fixed Call / Get a Quote bar for phones; sits after the footer so it never hides content. */
export function MobileActionBar() {
  const pathname = usePathname();
  if (HIDDEN.has(pathname) || pathname.startsWith("/booking/")) return null;

  return (
    <>
      <div className="h-[4.5rem] bg-night lg:hidden" aria-hidden="true" />
      <nav
        aria-label="Call or get a quote"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(11_26_51/0.25)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-md gap-3">
          <a
            href={site.phone.href}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-line font-semibold text-ink transition-colors hover:border-ink"
          >
            <Icon name="phone" className="size-4" />
            Call
          </a>
          <Link
            href="/quote"
            className="inline-flex h-12 flex-[2] items-center justify-center rounded-xl bg-ink font-bold text-white transition hover:bg-night-3"
          >
            Get a Quote
          </Link>
        </div>
      </nav>
    </>
  );
}
