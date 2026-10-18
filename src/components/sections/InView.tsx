"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Holds the drawn animations inside it until it scrolls into view, so a taxi
 * below the fold drives in when the visitor reaches it rather than unseen.
 * Marks itself once; the CSS in globals.css does the pausing.
 */
export function InView({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.setAttribute("data-inview", "");
    if (typeof IntersectionObserver === "undefined") return show();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`art-scope ${className ?? ""}`}>
      {/* Without JavaScript nothing would mark it, so let it play straight away. */}
      <noscript>
        <style>{".art-scope,.art-scope *{animation-play-state:running!important}"}</style>
      </noscript>
      {children}
    </div>
  );
}
