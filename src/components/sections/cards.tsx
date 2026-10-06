import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { fleet } from "@/config/fleet";
import { airportContent } from "@/content/airports";
import { airports } from "@/lib/domain/airports";
import type { AirportCode } from "@/lib/domain/types";

export function AirportGrid({ exclude }: { exclude?: AirportCode }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {airports
        .filter((a) => a.code !== exclude)
        .map((a) => (
          <li key={a.code}>
            <Link
              href={`/${a.slug}`}
              className="group flex h-full flex-col rounded-3xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-ink-faint hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-2xl font-bold">{a.shortName}</h3>
                <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-xs font-bold text-ink-soft">{a.code}</span>
              </div>
              <p className="mt-3 flex-1 leading-relaxed text-ink-soft">{airportContent[a.code].location}</p>
              <p className="mt-4 text-sm text-ink-soft">
                {a.terminals.length > 1
                  ? `${a.terminals.length} terminals: ${a.terminals.map((t) => t.name.replace("Terminal ", "")).join(", ")}`
                  : "Single terminal"}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-ink">
                {a.shortName} transfers
                <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </li>
        ))}
    </ul>
  );
}

export function FleetGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fleet.map((v) => (
        <li key={v.id} className="flex flex-col rounded-3xl border border-line bg-white p-6">
          <h3 className="font-display text-2xl font-bold">{v.name}</h3>
          <p className="mt-2 flex-1 leading-relaxed text-ink-soft">{v.summary}</p>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["user", "Passengers", v.maxPassengers],
                ["suitcase", "Large cases", v.maxLargeCases],
                ["bag", "Small bags", v.maxSmallCases],
              ] as const
            ).map(([icon, label, n]) => (
              <div key={label} className="rounded-2xl bg-surface px-2 py-3">
                <dt className="flex flex-col items-center gap-1 text-xs text-ink-soft">
                  <Icon name={icon} className="size-4" />
                  {label}
                </dt>
                <dd className="mt-1 font-display text-xl font-bold">{n}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
