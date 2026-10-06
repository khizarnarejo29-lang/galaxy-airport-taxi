import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { pricing } from "@/config/pricing";
import { site } from "@/config/site";
import { getServices } from "@/lib/services";
import { bookingSummaryRows } from "@/lib/services/notifications/templates";
import { formatGBP } from "@/lib/utils/money";

export const metadata: Metadata = {
  title: "Booking received",
  robots: { index: false, follow: false },
};

export default async function BookingPage({ params }: PageProps<"/booking/[reference]">) {
  const { reference } = await params;
  if (!/^GAT-[A-Z0-9]{6}$/i.test(reference)) notFound();
  const booking = await getServices().bookings.findByReference(reference);
  if (!booking) notFound();

  // Reference and total get their own treatment; the rest is a plain list.
  const rows = bookingSummaryRows(booking).filter(([k]) => k !== "Booking reference" && k !== "Total fare");

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
        <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/5">
          <div className="bg-night px-6 py-8 text-white sm:px-8">
            <span className="grid size-12 place-items-center rounded-full bg-success text-white">
              <Icon name="check" className="size-6" />
            </span>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Booking received</h1>
            <p className="mt-2 text-white/75">
              Thank you, {booking.customer.name.split(" ")[0]}. Your journey has been recorded.
            </p>
            <div className="mt-6 inline-flex flex-col rounded-2xl bg-white/8 px-5 py-3 ring-1 ring-white/15">
              <span className="text-xs font-semibold tracking-wide text-white/60 uppercase">Booking reference</span>
              <span className="font-display text-2xl font-bold tracking-wider text-accent">{booking.reference}</span>
            </div>
          </div>

          <div className="px-6 py-7 sm:px-8">
            <h2 className="font-display text-lg font-bold">Journey summary</h2>
            <dl className="mt-4 divide-y divide-line text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex gap-4 py-2.5">
                  <dt className="w-36 shrink-0 text-ink-soft">{k}</dt>
                  <dd className="min-w-0 flex-1 font-medium break-words">{v}</dd>
                </div>
              ))}
            </dl>

            <dl className="mt-6 space-y-1.5 rounded-2xl bg-surface p-5 text-sm">
              {booking.lines.map((l) => (
                <div key={l.code} className="flex justify-between gap-4 text-ink-soft">
                  <dt>{l.label}</dt>
                  <dd className="tabular-nums">{formatGBP(l.amount)}</dd>
                </div>
              ))}
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-semibold">Total fare</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{formatGBP(booking.total)}</dd>
              </div>
              <div className="flex justify-between gap-4 pt-1 text-ink-soft">
                <dt>Payment</dt>
                <dd>{booking.payment.method}</dd>
              </div>
            </dl>
            {pricing.isPlaceholder && (
              <p className="mt-3 text-xs text-ink-soft">Sample pricing for testing — not a live fare.</p>
            )}

            <div className="mt-8 rounded-2xl border border-line p-5">
              <h2 className="font-display text-lg font-bold">Need to change something?</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Contact us and quote your booking reference <strong className="text-ink">{booking.reference}</strong>.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={site.phone.href}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-night-3"
                >
                  <Icon name="phone" className="size-4" />
                  {site.phone.display}
                </a>
                <a
                  href={`mailto:${site.email}?subject=${encodeURIComponent(`Booking ${booking.reference}`)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold hover:border-ink-faint"
                >
                  <Icon name="mail" className="size-4" />
                  Email us
                </a>
              </div>
            </div>

            <Link href="/" className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-sky hover:underline">
              <Icon name="arrowLeft" className="size-4" />
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
