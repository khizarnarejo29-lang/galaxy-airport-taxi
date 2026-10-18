"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";

const WHATSAPP_GLYPH =
  "M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.29Z";

/**
 * WhatsApp and email buttons fixed to the bottom-right corner, above the phone action bars.
 * On phones only WhatsApp shows (email is in the footer), and it steps aside while the
 * calculator's prices are on screen, so it never covers one.
 */
export function FloatingContact() {
  const pricesInView = usePricesInView();
  if (!site.whatsapp) return null;
  return (
    <div
      className={
        "fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-3 transition-opacity print:hidden " +
        "lg:visible lg:right-6 lg:bottom-6 lg:opacity-100 " +
        (pricesInView ? "invisible opacity-0" : "visible opacity-100")
      }
    >
      <a
        href={`mailto:${site.email}`}
        aria-label={`Email us at ${site.email}`}
        title={site.email}
        className="hidden size-12 items-center justify-center rounded-full bg-white lg:flex text-ink shadow-card ring-1 ring-navy-900/10 transition hover:scale-105 hover:bg-surface"
      >
        <Icon name="mail" className="size-5" />
      </a>
      <a
        href={site.whatsapp.href}
        target="_blank"
        rel="noopener"
        aria-label="Chat with us on WhatsApp (opens in a new tab)"
        title={`WhatsApp ${site.whatsapp.display}`}
        className="flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-card transition hover:scale-105 hover:bg-[#1ebe5a]"
      >
        <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true">
          <path d={WHATSAPP_GLYPH} fill="currentColor" />
        </svg>
      </a>
    </div>
  );
}

/** Calculator steps that list prices. */
const PRICE_STEPS = ["vehicle", "review"];

/** True while the calculator is on screen at a step that lists prices. */
function usePricesInView() {
  const [state, setState] = useState({ visible: false, step: "" });
  useEffect(() => {
    const calculator = document.querySelector<HTMLElement>("[data-calculator]");
    if (!calculator) return;
    const read = () => setState((s) => ({ ...s, step: calculator.dataset.step ?? "" }));
    read();
    const io = new IntersectionObserver(([entry]) => setState((s) => ({ ...s, visible: entry.isIntersecting })));
    io.observe(calculator);
    const mo = new MutationObserver(read);
    mo.observe(calculator, { attributes: true, attributeFilter: ["data-step"] });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return state.visible && PRICE_STEPS.includes(state.step);
}
