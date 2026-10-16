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
          {/* Luggage space isn't shown: the fleet figures are unconfirmed and differ by vehicle. */}
          <p className="mt-5 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-ink-soft">
            <Icon name="user" className="size-4 shrink-0" />
            Up to {v.maxPassengers} passengers
          </p>
        </li>
      ))}
    </ul>
  );
}
