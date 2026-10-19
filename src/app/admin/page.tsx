import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getVehicle } from "@/config/fleet";
import { ADMIN_COOKIE, adminPassword, isValidAdminSession } from "@/lib/admin/session";
import { describeEnd } from "@/lib/domain/route";
import type { Booking } from "@/lib/domain/types";
import { getServices } from "@/lib/services";
import { bookingSummaryRows } from "@/lib/services/notifications/templates";
import { formatJourneyDate } from "@/lib/utils/dates";
import { formatGBP } from "@/lib/utils/money";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

// Always rendered per request: the password and sign-in are read at request time, never at build.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
    </div>
  );
}

function Login({ error }: { error: boolean }) {
  return (
    <Shell>
      <form method="post" action="/admin/login" className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-card ring-1 ring-navy-900/5 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">Bookings</h1>
        <p className="mt-1 text-sm text-ink-soft">Enter the admin password.</p>
        <label htmlFor="admin-password" className="mt-6 block text-sm font-semibold">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1.5 block h-12 w-full rounded-(--radius-control) border border-line px-4 text-base focus:border-sky focus:outline-none focus:ring-4 focus:ring-sky/15"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            That password isn&apos;t right.
          </p>
        )}
        <button type="submit" className="mt-5 h-12 w-full rounded-xl bg-ink font-bold text-white transition hover:bg-night-3">
          Sign in
        </button>
      </form>
    </Shell>
  );
}

const when = (b: Booking) => `${formatJourneyDate(b.journey.date)}, ${b.journey.time}`;

/** What the list shows for one booking, or null if a stored row can't be read (it is skipped, not fatal). */
function view(b: Booking) {
  try {
    return {
      when: when(b),
      route: `${describeEnd(b.journey.pickup)} → ${describeEnd(b.journey.dropoff)}${b.journey.tripType === "return" ? " (return)" : ""}`,
      rows: [
        ...bookingSummaryRows(b),
        ["Customer email", b.customer.email] as [string, string],
        ["Booked at", new Date(b.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })] as [string, string],
      ],
    };
  } catch {
    return null;
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!adminPassword()) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-semibold">Bookings</h1>
        <p className="mt-2 text-ink-soft">The admin page is off. Set ADMIN_PASSWORD (10+ characters) in the hosting settings to use it.</p>
      </Shell>
    );
  }
  if (!isValidAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return <Login error={(await searchParams).error === "1"} />;
  }

  const repo = getServices().bookings;
  let bookings: Booking[] = [];
  let problem: string | null = null;
  try {
    bookings = repo.list ? await repo.list(PAGE_SIZE) : [];
    if (!repo.list) problem = "This storage can't list bookings.";
  } catch {
    problem = "The bookings couldn't be loaded. Check the database settings.";
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Bookings</h1>
          <p className="mt-1 text-sm text-ink-soft">Newest first, up to {PAGE_SIZE}. Tap a booking for its details.</p>
        </div>
        <form method="post" action="/admin/logout">
          <button type="submit" className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:border-ink">
            Sign out
          </button>
        </form>
      </div>

      {problem && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          {problem}
        </p>
      )}
      {!problem && bookings.length === 0 && <p className="mt-6 text-ink-soft">No bookings yet.</p>}

      <ul className="mt-6 space-y-3">
        {bookings.map((b) => ({ b, v: view(b) })).map(({ b, v }) => !v ? (
          <li key={b.reference} className="rounded-2xl bg-white p-4 text-sm text-ink-soft ring-1 ring-navy-900/5">
            {b.reference}: this booking couldn&apos;t be read. Check it in the database.
          </li>
        ) : (
          <li key={b.reference}>
            <details className="group rounded-2xl bg-white shadow-card ring-1 ring-navy-900/5">
              <summary className="grid cursor-pointer list-none gap-x-6 gap-y-1 p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:p-5">
                <span className="font-display text-lg font-semibold tracking-wide">{b.reference}</span>
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold">{v.when}</span>
                  <span className="block truncate text-ink-soft">{v.route}</span>
                  <span className="block text-ink-soft">
                    {b.customer.name} · {b.customer.phone}
                  </span>
                </span>
                <span className="text-sm sm:text-right">
                  <span className="block font-display text-xl font-semibold">{formatGBP(b.total)}</span>
                  <span className="block text-ink-soft">
                    {getVehicle(b.vehicleId)?.name} · {b.payment.status === "paid" ? "Paid" : "Not paid"}
                  </span>
                </span>
              </summary>
              <dl className="border-t border-line px-4 py-3 text-sm sm:px-5">
                {v.rows.map(([k, value]) => (
                  <div key={k} className="flex gap-4 border-b border-dashed border-line py-2 last:border-b-0">
                    <dt className="w-40 shrink-0 text-ink-soft">{k}</dt>
                    <dd className="min-w-0 flex-1 break-words font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
