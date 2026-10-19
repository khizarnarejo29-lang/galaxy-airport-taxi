/**
 * The one place that decides which implementation backs each service.
 * Swap an implementation here (driven by env vars) and nothing else changes.
 * Server-only: never import this from a client component.
 */
import "server-only";
import {
  memoryBookingRepository,
  supabaseBookingRepository,
  unavailableBookingRepository,
  type BookingRepository,
} from "./bookings";
import { estimatedDistance, googleRoutesDistance, type DistanceProvider } from "./distance";
import { unverifiedFlights, type FlightInfoProvider } from "./flights";
import { googlePlaces } from "./location/google-places";
import { postcodesIo } from "./location/postcodes-io";
import type { LocationProvider } from "./location/types";
import { emailNotifier, logEmailSender, type EmailSender, type Notifier } from "./notifications";
import { smtpConfigFromEnv, smtpEmailSender } from "./notifications/smtp";
import { paymentLater, type PaymentProvider } from "./payments";
import { stripeConfigFromEnv, stripePayments } from "./stripe";
import {
  memoryQuoteRequestRepository,
  supabaseQuoteRequestRepository,
  unavailableQuoteRequestRepository,
  type QuoteRequestRepository,
} from "./quote-requests";
import { createMysqlPool, mysqlBookingRepository, mysqlConfigFromEnv, mysqlQuoteRequestRepository } from "./mysql/storage";
import { createSupabaseServerClient, supabaseConfigFromEnv } from "./supabase/server-client";
import { site } from "@/config/site";

export interface Services {
  locations: LocationProvider;
  distance: DistanceProvider;
  flights: FlightInfoProvider;
  payments: PaymentProvider;
  notifier: Notifier;
  bookings: BookingRepository;
  /** Storage only for now: nothing on the website creates quote requests yet. */
  quoteRequests: QuoteRequestRepository;
  /** False when bookings can't be saved (no storage in production): customers book by WhatsApp or phone. */
  onlineBooking?: boolean;
}

export interface Storage {
  kind: "supabase" | "mysql" | "memory" | "unavailable";
  bookings: BookingRepository;
  quoteRequests: QuoteRequestRepository;
}

type Env = Partial<Record<string, string | undefined>>;

/**
 * Supabase or MySQL (e.g. Hostinger's database) when configured. Without either: in-memory storage in development,
 * and in production no storage at all, so bookings are refused rather than lost.
 */
export function chooseStorage(env: Env = process.env): Storage {
  const config = supabaseConfigFromEnv(env);
  if (config) {
    const client = createSupabaseServerClient(config);
    return { kind: "supabase", bookings: supabaseBookingRepository(client), quoteRequests: supabaseQuoteRequestRepository(client) };
  }
  const mysql = mysqlConfigFromEnv(env);
  if (mysql) {
    const pool = createMysqlPool(mysql);
    return { kind: "mysql", bookings: mysqlBookingRepository(pool), quoteRequests: mysqlQuoteRequestRepository(pool) };
  }
  if (env.NODE_ENV === "production") {
    console.error("[storage] No database is set (MYSQL_* or SUPABASE_*): online bookings are refused.");
    return { kind: "unavailable", bookings: unavailableBookingRepository(), quoteRequests: unavailableQuoteRequestRepository() };
  }
  console.warn("[storage] Supabase is not configured: using in-memory storage (lost on restart).");
  return { kind: "memory", bookings: memoryBookingRepository(), quoteRequests: memoryQuoteRequestRepository() };
}

/**
 * Card payments online when Stripe's keys are set and bookings can be saved;
 * otherwise bookings are taken unpaid, to be paid as arranged.
 */
export function choosePayments(storage: Pick<Storage, "kind">, env: Env = process.env): PaymentProvider {
  const stripe = stripeConfigFromEnv(env);
  if (stripe && storage.kind !== "unavailable") return stripePayments(stripe);
  return paymentLater;
}

/** Real email when an SMTP mailbox is set (SMTP_HOST, SMTP_USER, SMTP_PASSWORD); otherwise emails are only logged. */
export function chooseEmailSender(env: Env = process.env): EmailSender {
  const smtp = smtpConfigFromEnv(env);
  return smtp ? smtpEmailSender(smtp) : logEmailSender;
}

/** Google address search when GOOGLE_MAPS_API_KEY is set; otherwise postcode and area search (postcodes.io). */
export function chooseLocations(env: Env = process.env): LocationProvider {
  const key = env.GOOGLE_MAPS_API_KEY?.trim();
  return key ? googlePlaces(key) : postcodesIo;
}

/**
 * Real road miles from Google only when ROAD_DISTANCE=google is also set: the
 * tariff's per-mile figures were set against the estimate, so switching changes
 * prices and must follow a tariff check (see docs/TARIFF.md).
 */
export function chooseDistance(env: Env = process.env): DistanceProvider {
  const key = env.GOOGLE_MAPS_API_KEY?.trim();
  return key && env.ROAD_DISTANCE === "google" ? googleRoutesDistance(key) : estimatedDistance();
}

let services: Services | undefined;

export function getServices(): Services {
  if (!services) {
    const storage = chooseStorage();
    services = {
      locations: chooseLocations(),
      distance: chooseDistance(),
      flights: unverifiedFlights,
      payments: choosePayments(storage),
      notifier: emailNotifier(chooseEmailSender(), process.env.BOOKINGS_NOTIFY_EMAIL || site.email),
      bookings: storage.bookings,
      quoteRequests: storage.quoteRequests,
      onlineBooking: storage.kind !== "unavailable",
    };
  }
  return services;
}
