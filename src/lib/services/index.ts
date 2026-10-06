/**
 * The one place that decides which implementation backs each service.
 * Swap an implementation here (driven by env vars) and nothing else changes.
 * Server-only: never import this from a client component.
 */
import { memoryBookingRepository, type BookingRepository } from "./bookings";
import { estimatedDistance, type DistanceProvider } from "./distance";
import { unverifiedFlights, type FlightInfoProvider } from "./flights";
import { postcodesIo } from "./location/postcodes-io";
import type { LocationProvider } from "./location/types";
import { emailNotifier, logEmailSender, type Notifier } from "./notifications";
import { paymentLater, type PaymentProvider } from "./payments";
import { site } from "@/config/site";

export interface Services {
  locations: LocationProvider;
  distance: DistanceProvider;
  flights: FlightInfoProvider;
  payments: PaymentProvider;
  notifier: Notifier;
  bookings: BookingRepository;
}

let services: Services | undefined;

export function getServices(): Services {
  services ??= {
    locations: postcodesIo,
    distance: estimatedDistance(),
    flights: unverifiedFlights,
    payments: paymentLater,
    notifier: emailNotifier(logEmailSender, process.env.BOOKINGS_NOTIFY_EMAIL || site.email),
    bookings: memoryBookingRepository(),
  };
  return services;
}
