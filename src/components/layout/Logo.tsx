import Image from "next/image";

/** The brand mark (the white car from the supplied logo on its purple square) beside the name. */
export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const text = tone === "light" ? "text-white" : "text-ink";
  return (
    <span className={`inline-flex items-center gap-2 sm:gap-2.5 ${text}`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#653bbb] sm:size-9" aria-hidden="true">
        <Image src="/brand/car-mark.png" alt="" width={654} height={338} className="w-[78%]" priority />
      </span>
      <span className="font-display text-[0.95rem] leading-none font-bold tracking-tight whitespace-nowrap sm:text-[1.05rem]">
        Galaxy<span className="font-medium opacity-70"> Airport Taxi</span>
      </span>
    </span>
  );
}
