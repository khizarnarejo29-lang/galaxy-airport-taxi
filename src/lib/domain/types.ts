import type { Pence } from "@/lib/utils/money";

export type Direction = "to_airport" | "from_airport";
export type AirportCode = "LHR" | "LGW" | "STN" | "LTN" | "LCY";
export type VehicleId = "saloon" | "estate" | "executive" | "mpv" | "minibus";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Terminal {
  id: string;
  name: string;
}

export interface Airport extends LatLng {
  code: AirportCode;
  name: string;
  shortName: string;
  slug: string;
  terminals: Terminal[];
}

/** A place resolved by the location provider (postcode or named area). */
export interface ResolvedLocation extends LatLng {
  /** Provider-scoped id the server can resolve again, e.g. "pc:SW1A1AA". */
  id: string;
  kind: "postcode" | "place";
  label: string;
  /** Full postcode when known (always for kind "postcode"). */
  postcode?: string;
  /** Postcode district, e.g. "SW1A". */
  outcode?: string;
  district?: string;
  region?: string;
}

/** Customer-supplied address detail layered on a resolved location. */
export interface AddressDetail {
  locationId: string;
  /** House number/name and street. Required to book, optional to quote. */
  line1?: string;
  /** Needed to book when the location was a named area rather than a postcode. */
  postcode?: string;
}

export interface Luggage {
  large: number;
  small: number;
}

export interface Vehicle {
  id: VehicleId;
  name: string;
  maxPassengers: number;
  maxLargeCases: number;
  maxSmallCases: number;
  summary: string;
}

/** Everything needed to price a journey. */
export interface JourneyInput {
  direction: Direction;
  airport: AirportCode;
  terminal?: string;
  address: AddressDetail;
  extraStops: AddressDetail[];
  /** London local date, YYYY-MM-DD. */
  date: string;
  /** London local time, HH:mm. Landing time for airport pickups. */
  time: string;
  passengers: number | null;
  luggage: Luggage;
  flightNumber?: string;
}

export interface AddOns {
  meetAndGreet: boolean;
  childSeats: number;
}

export interface PriceLine {
  code: string;
  label: string;
  amount: Pence;
}

export interface QuoteOption {
  vehicleId: VehicleId;
  available: boolean;
  unavailableReason?: string;
  lines: PriceLine[];
  total: Pence;
}

/** A journey after the server has resolved locations and measured distance. */
export interface PricedJourney {
  direction: Direction;
  airport: AirportCode;
  terminal?: string;
  address: ResolvedLocation & { line1?: string };
  extraStops: (ResolvedLocation & { line1?: string })[];
  date: string;
  time: string;
  pickupAtUtc: string;
  passengers: number;
  luggage: Luggage;
  flightNumber?: string;
  distanceMiles: number;
}

export interface Quote {
  journey: PricedJourney;
  options: QuoteOption[];
  pricingVersion: string;
  issuedAt: string;
  expiresAt: string;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
}

export type BookingStatus = "received" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "invoiced";

export interface Booking {
  reference: string;
  status: BookingStatus;
  journey: PricedJourney;
  vehicleId: VehicleId;
  addOns: AddOns;
  lines: PriceLine[];
  total: Pence;
  pricingVersion: string;
  customer: Customer;
  specialRequirements?: string;
  notes?: string;
  payment: { status: PaymentStatus; method: string };
  flightCheck: { status: "unverified" | "verified" | "not_found" };
  createdAt: string;
}

export interface FieldError {
  /** Dotted path of the field, e.g. "terminal" or "customer.email". */
  field: string;
  code: string;
  message: string;
}
