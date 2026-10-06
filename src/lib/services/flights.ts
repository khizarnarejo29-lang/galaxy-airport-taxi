import type { AirportCode, Booking } from "@/lib/domain/types";

export interface FlightInfoProvider {
  /** Check a flight against live schedule data. */
  check(flightNumber: string, date: string, airport: AirportCode): Promise<Booking["flightCheck"]>;
}

/** No live data yet: flight numbers are format-checked only and stored for the driver. */
export const unverifiedFlights: FlightInfoProvider = {
  async check() {
    return { status: "unverified" };
  },
};
