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
import { estimatedDistance, type DistanceProvider } from "./distance";
import { unverifiedFlights, type FlightInfoProvider } from "./flights";
import { postcodesIo } from "./location/postcodes-io";
import type { LocationProvider } from "./location/types";
import { emailNotifier, logEmailSender, type Notifier } from "./notifications";
import { paymentLater, type PaymentProvider } from "./payments";
import {
  memoryQuoteRequestRepository,
  supabaseQuoteRequestRepository,
  unavailableQuoteRequestRepository,
  type QuoteRequestRepository,
} from "./quote-requests";
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
}

export interface Storage {
  kind: "supabase" | "memory" | "unavailable";
  bookings: BookingRepository;
  quoteRequests: QuoteRequestRepository;
}

type Env = Partial<Record<string, string | undefined>>;

/**
 * Supabase when configured. Without it: in-memory storage in development,
 * and in production no storage at all, so bookings are refused rather than lost.
 */
export function chooseStorage(env: Env = process.env): Storage {
  const config = supabaseConfigFromEnv(env);
  if (config) {
    const client = createSupabaseServerClient(config);
    return { kind: "supabase", bookings: supabaseBookingRepository(client), quoteRequests: supabaseQuoteRequestRepository(client) };
  }
  if (env.NODE_ENV === "production") {
    console.error("[storage] SUPABASE_URL / SUPABASE_SECRET_KEY are not set: online bookings are refused.");
    return { kind: "unavailable", bookings: unavailableBookingRepository(), quoteRequests: unavailableQuoteRequestRepository() };
  }
  console.warn("[storage] Supabase is not configured: using in-memory storage (lost on restart).");
  return { kind: "memory", bookings: memoryBookingRepository(), quoteRequests: memoryQuoteRequestRepository() };
}

let services: Services | undefined;

export function getServices(): Services {
  if (!services) {
    const storage = chooseStorage();
    services = {
      locations: postcodesIo,
      distance: estimatedDistance(),
      flights: unverifiedFlights,
      payments: paymentLater,
      notifier: emailNotifier(logEmailSender, process.env.BOOKINGS_NOTIFY_EMAIL || site.email),
      bookings: storage.bookings,
      quoteRequests: storage.quoteRequests,
    };
  }
  return services;
}
