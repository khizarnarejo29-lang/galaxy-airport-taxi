"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * "Get a Quote": on a page that already shows the calculator, scrolls to it
 * instead of leaving the page, so a quote in progress stays where it is.
 * Elsewhere it is an ordinary link to /quote.
 */
export function QuoteLink({ onClick, ...props }: Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      {...props}
      href="/quote"
      onClick={(e) => {
        onClick?.(e);
        // Let modified clicks (new tab, new window) behave as normal links.
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const calculator = document.querySelector<HTMLElement>("[data-calculator]");
        if (!calculator) return;
        e.preventDefault();
        calculator.scrollIntoView({ behavior: "smooth", block: "start" });
        calculator.querySelector<HTMLElement>("[data-calculator-heading]")?.focus({ preventScroll: true });
      }}
    />
  );
}
