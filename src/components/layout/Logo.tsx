/** Wordmark: an orbit ring with a single star — "Galaxy" without clip-art. */
export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const text = tone === "light" ? "text-white" : "text-ink";
  return (
    <span className={`inline-flex items-center gap-2 sm:gap-2.5 ${text}`}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0 sm:size-8" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="#121a44" />
        <ellipse cx="16" cy="16" rx="11" ry="5" fill="none" stroke="#6d7cff" strokeWidth="1.6" transform="rotate(-25 16 16)" />
        <circle cx="16" cy="16" r="4.2" fill="#ffb23f" />
        <circle cx="25" cy="10.5" r="1.4" fill="#fff" />
      </svg>
      <span className="font-display text-[0.95rem] leading-none font-bold tracking-tight whitespace-nowrap sm:text-[1.05rem]">
        Galaxy<span className="font-medium opacity-70"> Airport Taxi</span>
      </span>
    </span>
  );
}
