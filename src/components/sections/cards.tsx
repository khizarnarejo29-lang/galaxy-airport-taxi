import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { fleet } from "@/config/fleet";
import { airportContent } from "@/content/airports";
import { airports, getAirport } from "@/lib/domain/airports";
import type { AirportCode, VehicleId } from "@/lib/domain/types";
import { centralLondonFrom, exampleFares, exampleVehicles } from "@/lib/pricing/example-fares";
import { formatGBP, type Pence } from "@/lib/utils/money";

export function AirportGrid({ exclude }: { exclude?: AirportCode }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {airports
        .filter((a) => a.code !== exclude)
        .map((a) => {
          const from = centralLondonFrom(a.code);
          return (
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
              {from !== null && (
                <p className="mt-4 flex items-baseline justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3">
                  <span className="text-sm text-ink-soft">Central London, saloon</span>
                  <span className="font-display text-xl font-bold text-ink">from {formatGBP(from)}</span>
                </p>
              )}
              <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-ink">
                {a.shortName} transfers
                <Icon name="arrowRight" className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </li>
          );
        })}
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

export interface PriceRow {
  label: string;
  sub?: string;
  prices: Partial<Record<VehicleId, Pence>>;
}

/** One-way prices per vehicle, one row per journey. Scrolls sideways on small screens. */
export function PriceTable({ label, firstColumn = "From", rows }: { label: string; firstColumn?: string; rows: PriceRow[] }) {
  if (!rows.length) return null;
  const vehicles = exampleVehicles.map((id) => fleet.find((v) => v.id === id)!);
  return (
    // Focusable so keyboard users can scroll the table sideways on small screens.
    <div
      className="overflow-x-auto rounded-3xl border border-line bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">{label}: one-way prices by vehicle</caption>
        <thead className="bg-surface text-xs font-bold tracking-wider text-ink-soft uppercase">
          <tr>
            <th scope="col" className="px-5 py-3.5">{firstColumn}</th>
            {vehicles.map((v) => (
              <th key={v.id} scope="col" className="px-4 py-3.5 text-right">{v.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={`${r.label}-${r.sub ?? ""}`}>
              <th scope="row" className="px-5 py-3.5 font-normal">
                <span className="block font-semibold text-ink">{r.label}</span>
                {r.sub && <span className="text-ink-soft">{r.sub}</span>}
              </th>
              {vehicles.map((v) => (
                <td key={v.id} className="px-4 py-3.5 text-right font-display text-base font-semibold tabular-nums">
                  {r.prices[v.id] !== undefined ? formatGBP(r.prices[v.id]!) : "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Example one-way prices from several London areas to one airport, per vehicle. */
export function ExampleFaresTable({ airport }: { airport: AirportCode }) {
  const rows = exampleFares(airport).map((r) => ({ label: r.area, sub: r.postcode, prices: r.prices }));
  return <PriceTable label={`${getAirport(airport)?.name ?? airport} prices`} rows={rows} />;
}
