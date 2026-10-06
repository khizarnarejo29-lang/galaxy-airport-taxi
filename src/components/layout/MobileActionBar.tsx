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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md gap-3">
          <a
            href={site.phone.href}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line font-semibold text-ink"
          >
            <Icon name="phone" className="size-4" />
            Call
          </a>
          <Link
            href="/quote"
            className="inline-flex h-12 flex-[2] items-center justify-center rounded-2xl bg-accent font-bold text-ink"
          >
            Get a Quote
          </Link>
        </div>
      </div>
    </>
  );
}
