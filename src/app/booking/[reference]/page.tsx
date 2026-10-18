import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { bookingView } from "@/lib/booking/booking-view";
import { VIEW_PASS_COOKIE } from "@/lib/booking/view-pass";
import { getServices } from "@/lib/services";
import { bookingSummaryRows } from "@/lib/services/notifications/templates";
import { formatGBP } from "@/lib/utils/money";

export const metadata: Metadata = {
  title: "Booking received",
  robots: { index: false, follow: false },
};

/** Shown without a valid viewing pass, or when bookings can't be read: the reference only, no personal details. */
function ReferenceOnly({ message }: { message: string }) {
  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
        <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/5">
          <div className="bg-night px-6 py-8 text-white sm:px-8">
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Your booking</h1>
            <p className="mt-3 text-lg text-white/80">{message}</p>
            <a
              href={site.phone.href}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-ink transition hover:bg-accent-soft"
            >
              <Icon name="phone" className="size-4" />
              {site.phone.display}
            </a>
          </div>
          <div className="px-6 py-7 sm:px-8">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky hover:underline">
              <Icon name="arrowLeft" className="size-4" />
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What the card payment page sent the customer back with. */
const PAYMENT_NOTES: Record<string, { tone: "good" | "warn"; text: string }> = {
  success: { tone: "good", text: "Thank you, your card payment has gone through. It can take a minute to show here." },
  cancelled: { tone: "warn", text: "Your payment wasn’t completed and you haven’t been charged. You can pay below, or call us." },
  error: { tone: "warn", text: "We couldn’t open the card payment page. Please try again, or call us." },
  expired: { tone: "warn", text: "For your security, please call us to pay for this booking." },
};

export default async function BookingPage({ params, searchParams }: PageProps<"/booking/[reference]">) {
  const { reference } = await params;
  const { payment: returned } = await searchParams;
  const pass = (await cookies()).get(VIEW_PASS_COOKIE)?.value;
  const view = await bookingView(reference, pass, getServices().bookings);

  if (view.kind === "not_found") notFound();
  if (view.kind === "unavailable") {
    return (
      <ReferenceOnly
        message={`We can’t show your booking details right now. Your booking reference is ${view.reference}. Please call us on ${site.phone.display} if you need anything.`}
      />
    );
  }
  if (view.kind === "restricted") {
    // Until confirmation emails are delivered, don't point customers to them.
    return (
      <ReferenceOnly
        message={`Booking ${view.reference} has been received. Please call us on ${site.phone.display} if you need anything.`}
      />
    );
  }
  const { booking } = view;
  const paid = booking.payment.status === "paid";
  const canPay = !paid && booking.status !== "cancelled" && Boolean(getServices().payments.checkout);
  const note = typeof returned === "string" && !(paid && returned !== "success") ? PAYMENT_NOTES[returned] : undefined;

  // Reference and total get their own treatment; the rest is a plain list.
  const rows = bookingSummaryRows(booking).filter(([k]) => k !== "Booking reference" && k !== "Total fare");

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
        <article className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-navy-900/5 sm:rounded-3xl">
          <header className="bg-night px-6 pt-8 pb-10 text-white sm:px-10">
            <span className="grid size-12 place-items-center rounded-full bg-success text-white ring-4 ring-success/25">
              <Icon name="check" className="size-6" />
            </span>
            <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Booking received</h1>
            <p className="mt-2 text-white/75">
              Thank you, {booking.customer.name.split(" ")[0]}. Your journey has been recorded.
            </p>
            <div className="mt-6 inline-flex flex-col rounded-xl border border-white/15 bg-white/6 px-5 py-3">
              <span className="text-xs font-semibold tracking-wider text-white/65 uppercase">Booking reference</span>
              <span className="font-display text-2xl font-semibold tracking-wider text-white">{booking.reference}</span>
            </div>
          </header>

          {/* Ticket-style tear line between the header and the receipt. */}
          <div className="relative h-0" aria-hidden="true">
            <span className="absolute -top-3 -left-3 size-6 rounded-full bg-surface" />
            <span className="absolute -top-3 -right-3 size-6 rounded-full bg-surface" />
          </div>

          <div className="px-6 pt-8 pb-8 sm:px-10">
            <h2 className="text-xs font-bold tracking-wider text-accent-strong uppercase">Journey summary</h2>
            <dl className="mt-3 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="border-b border-dashed border-line py-3 last:border-b-0 sm:flex sm:gap-6">
                  <dt className="text-xs text-ink-soft sm:w-40 sm:shrink-0 sm:text-sm">{k}</dt>
                  <dd className="mt-0.5 min-w-0 flex-1 font-medium break-words sm:mt-0">{v}</dd>
                </div>
              ))}
            </dl>

            <dl className="mt-6 space-y-2 rounded-xl border border-line bg-surface p-5 text-sm sm:p-6">
              {booking.lines.map((l) => (
                <div key={l.code} className="flex justify-between gap-4 text-ink-soft">
                  <dt>{l.label}</dt>
                  <dd className="tabular-nums">{formatGBP(l.amount)}</dd>
                </div>
              ))}
              <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <dt className="font-semibold">Total fare</dt>
                <dd className="font-display text-3xl font-semibold tabular-nums">{formatGBP(booking.total)}</dd>
              </div>
              <div className="flex justify-between gap-4 pt-1 text-ink-soft">
                <dt>Payment</dt>
                <dd className={`text-right ${paid ? "font-semibold text-success" : ""}`}>
                  {paid ? "Paid by card" : canPay ? "Not paid yet" : booking.payment.method}
                </dd>
              </div>
            </dl>

            {note && (
              <p
                role="status"
                className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                  note.tone === "good" ? "border-success/30 bg-success-soft text-success" : "border-danger/25 bg-danger-soft text-danger"
                }`}
              >
                {note.text}
              </p>
            )}

            {canPay && returned !== "success" && (
              <form method="post" action={`/booking/${booking.reference}/pay`} className="mt-4">
                <button
                  type="submit"
                  className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 text-base font-bold text-white transition hover:bg-night-3"
                >
                  Pay {formatGBP(booking.total)} by card
                  <Icon name="arrowRight" className="size-5" />
                </button>
                <p className="mt-2 text-center text-xs text-ink-soft">Secure payment by Stripe. Your card details never reach this website.</p>
              </form>
            )}

            <div className="mt-8 rounded-xl border border-line p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold tracking-tight">Need to change something?</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Contact us and quote your booking reference <strong className="text-ink">{booking.reference}</strong>.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={site.phone.href}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-semibold text-white transition hover:bg-night-3"
                >
                  <Icon name="phone" className="size-4" />
                  {site.phone.display}
                </a>
                <a
                  href={`mailto:${site.email}?subject=${encodeURIComponent(`Booking ${booking.reference}`)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-5 text-sm font-semibold transition hover:border-ink"
                >
                  <Icon name="mail" className="size-4" />
                  Email us
                </a>
              </div>
            </div>

            <Link
              href="/"
              className="mt-8 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sky underline-offset-2 hover:underline"
            >
              <Icon name="arrowLeft" className="size-4" />
              Back to home
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
