import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { Logo } from "./Logo";
import { SiteNav } from "./SiteNav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" aria-label={`${site.name} home`} className="shrink-0 rounded-lg">
          <Logo tone="dark" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <SiteNav />
          <a
            href={site.phone.href}
            className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-ink transition-colors hover:bg-surface sm:inline-flex xl:ml-2"
          >
            <Icon name="phone" className="size-4" />
            <span className="lg:sr-only xl:not-sr-only">{site.phone.display}</span>
          </a>
          <Link
            href="/quote"
            className="order-first inline-flex h-10 items-center rounded-xl bg-ink px-3.5 text-sm font-bold whitespace-nowrap text-white transition hover:bg-night-3 sm:px-4 lg:order-last"
          >
            Get a Quote
          </Link>
        </div>
      </div>
    </header>
  );
}
