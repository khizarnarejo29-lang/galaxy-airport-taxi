"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { isGroup, mainNav, type NavGroup } from "@/config/navigation";
import { site } from "@/config/site";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
const groupActive = (pathname: string, g: NavGroup) => g.children.some((c) => isActive(pathname, c.href));

/** Desktop menus (disclosure pattern) and the mobile slide-down menu. */
export function SiteNav() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menuId = useId();
  const [lastPath, setLastPath] = useState(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closedByEscape = useRef(false);

  // Close menus after navigating.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenGroup(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenGroup(null);
        closedByEscape.current = true;
        setMobileOpen(false);
      }
    }
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = mobileOpen ? "hidden" : "";
    // Focus was inside the menu that just unmounted: hand it back to the toggle.
    if (!mobileOpen && closedByEscape.current) {
      closedByEscape.current = false;
      toggleRef.current?.focus();
    }
  }, [mobileOpen]);

  const linkBase = "rounded-full px-3 py-2 text-sm font-semibold transition-colors";

  return (
    <nav ref={navRef} aria-label="Main" className="flex items-center">
      {/* Desktop */}
      <ul className="hidden items-center gap-0.5 lg:flex">
        {mainNav.map((item) =>
          isGroup(item) ? (
            <li key={item.label} className="relative">
              <button
                type="button"
                aria-expanded={openGroup === item.label}
                aria-controls={`${menuId}-${item.label}`}
                onClick={() => setOpenGroup((g) => (g === item.label ? null : item.label))}
                className={`${linkBase} inline-flex items-center gap-1 ${
                  groupActive(pathname, item) ? "text-white" : "text-white/75 hover:text-white"
                }`}
              >
                {item.label}
                <svg viewBox="0 0 12 12" className={`size-3 transition-transform ${openGroup === item.label ? "rotate-180" : ""}`} aria-hidden="true">
                  <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <ul
                id={`${menuId}-${item.label}`}
                hidden={openGroup !== item.label}
                className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white p-2 shadow-card ring-1 ring-black/5 animate-fade-in"
              >
                {item.children.map((c) => (
                  <li key={c.href}>
                    <Link
                      href={c.href}
                      aria-current={pathname === c.href ? "page" : undefined}
                      className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:font-bold"
                    >
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={`${linkBase} text-white/75 hover:text-white aria-[current=page]:text-white`}
              >
                {item.label}
              </Link>
            </li>
          ),
        )}
      </ul>

      {/* Mobile */}
      <button
        ref={toggleRef}
        type="button"
        className="grid size-10 place-items-center rounded-full text-white hover:bg-white/10 lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls={`${menuId}-mobile`}
        onClick={() => setMobileOpen((o) => !o)}
      >
        <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
        {mobileOpen ? (
          <Icon name="close" className="size-5" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {/* Portalled to <body>: the header's backdrop blur would otherwise trap a fixed element inside it. */}
      {mobileOpen && createPortal(<MobileMenu id={`${menuId}-mobile`} pathname={pathname} />, document.body)}
    </nav>
  );
}

function MobileMenu({ id, pathname }: { id: string; pathname: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("a")?.focus();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className="fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto bg-night px-4 pt-4 pb-10 animate-fade-in lg:hidden"
    >
      <ul className="space-y-1">
        {mainNav.map((item) => (
          <li key={item.label} className="border-b border-white/10 pb-1">
            {isGroup(item) ? (
              <>
                <p className="px-2 pt-3 pb-1 text-xs font-bold tracking-wider text-white/50 uppercase">{item.label}</p>
                <ul>
                  {item.children.map((c) => (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        aria-current={pathname === c.href ? "page" : undefined}
                        className="block rounded-xl px-2 py-3 text-base font-medium text-white/85 aria-[current=page]:text-accent"
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="block rounded-xl px-2 py-3.5 text-lg font-semibold text-white aria-[current=page]:text-accent"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-3">
        <Link href="/quote" className="flex h-13 items-center justify-center rounded-2xl bg-accent font-bold text-ink">
          Get a Quote
        </Link>
        <a
          href={site.phone.href}
          className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/20 font-semibold text-white"
        >
          <Icon name="phone" className="size-4" />
          Call {site.phone.display}
        </a>
      </div>
    </div>
  );
}
