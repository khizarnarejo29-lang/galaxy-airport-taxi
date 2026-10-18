import type { Pence } from "@/lib/utils/money";

/** Kept for the airport landing pages, which pre-select an airport as the pickup or the drop-off. */
export type Direction = "to_airport" | "from_airport";
/** Worked out from a journey's two ends; never chosen by the customer. Airport to airport is never allowed. */
export type JourneyKind = "to_airport" | "from_airport" | "address_to_address";
export type TripType = "one_way" | "return";
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
}

/** One end of a journey leg: an address found by postcode search, or one of the airports. */
export type JourneyEndInput =
  | ({ kind: "address" } & AddressDetail)
  | { kind: "airport"; airport: AirportCode; terminal?: string };

export interface Luggage {
  large: number;
  small: number;
}

/** Luggage in the reference website's terms, used to match reference fares. */
/** Luggage as one category, the same way the reference website asks for it. */
export const luggageCategories = ["none", "hand_luggage", "suitcases"] as const;
export type LuggageCategory = (typeof luggageCategories)[number];

/** The way back for a return booking. It always ends at the outward pickup. */
export interface ReturnJourneyInput {
  /** Usually the outward drop-off; may be another address, or another terminal at the same airport. */
  pickup: JourneyEndInput;
  extraStops: AddressDetail[];
  /** London local date, YYYY-MM-DD, and time, HH:mm, of the return pickup. */
  date: string;
  time: string;
  flightNumber?: string;
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
  pickup: JourneyEndInput;
  dropoff: JourneyEndInput;
  /** Stops on the outward leg, in order. */
  extraStops: AddressDetail[];
  /** London local date, YYYY-MM-DD. */
  date: string;
  /** London local time, HH:mm. Landing time when the pickup is an airport. */
  time: string;
  passengers: number | null;
  /** Legacy luggage counts. Not accepted from requests any more; kept only for older stored bookings. */
  luggage?: Luggage;
  flightNumber?: string;
  /** Defaults to one-way. A return needs `returnJourney`. */
  tripType?: TripType;
  returnJourney?: ReturnJourneyInput;
  /** Required by validation: none, hand luggage or suitcases. */
  luggageCategory?: LuggageCategory;
  /** With suitcases only: the party has hand luggage as well. Shown to the driver; priced as suitcases. */
  handLuggageToo?: boolean;
  /** Required by validation. True means large or unusual items: never priced instantly. */
  largeItems?: boolean;
  /** Extras the price should include; they must match the reference fare. */
  extras?: AddOns;
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

/** How a vehicle's price was decided. Signed into the quote token. */
export type OptionPricing =
  | {
      status: "priced";
      fareId: string;
      referenceTotal: Pence;
      checkedAt: string;
      /** The fare stops being usable at this instant. */
      validUntil: string;
      flags: string[];
    }
  /** Priced from Galaxy's own location tariff, used where no reference fare matches. */
  | {
      status: "tariff";
      /** The tariff's version; a booking is refused if the tariff changed since the quote. */
      tariffVersion: string;
      /** Event rates included, e.g. "Christmas rate". */
      events: string[];
    }
  | { status: "price_on_request"; reason: string };

export interface QuoteOption {
  vehicleId: VehicleId;
  /** True only when the vehicle fits and has a matched price. */
  available: boolean;
  unavailableReason?: string;
  lines: PriceLine[];
  /** 0 when the price is on request. */
  total: Pence;
  pricing: OptionPricing;
}

/** A resolved address with the customer's house number and street, once given. */
export type PricedAddress = ResolvedLocation & { line1?: string };

/** One end of a priced leg. A terminal is set for every airport end that has one. */
export type JourneyEnd =
  | { kind: "address"; address: PricedAddress }
  | { kind: "airport"; airport: AirportCode; terminal?: string };

/** A journey after the server has resolved locations and measured distance. */
export interface PricedJourney {
  pickup: JourneyEnd;
  dropoff: JourneyEnd;
  extraStops: PricedAddress[];
  date: string;
  time: string;
  pickupAtUtc: string;
  passengers: number;
  luggage: Luggage;
  flightNumber?: string;
  distanceMiles: number;
  tripType: TripType;
  returnJourney?: PricedReturnJourney;
  luggageCategory?: LuggageCategory;
  /** Hand luggage as well as suitcases. Display only: the suitcases fare applies. */
  handLuggageToo?: boolean;
  /** Large or unusual items declared: every vehicle is price on request. */
  largeItems?: boolean;
  /** Extras the quoted prices include. */
  extras: AddOns;
}

/** The way back. Its destination is always the outward pickup, so it isn't stored twice. */
export interface PricedReturnJourney {
  pickup: JourneyEnd;
  extraStops: PricedAddress[];
  date: string;
  time: string;
  pickupAtUtc: string;
  flightNumber?: string;
  /** Estimated miles for the way back, used by the location tariff. */
  distanceMiles?: number;
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
  /** The reference fare the total was taken from (reference total − £2). */
  referenceFare?: { id: string; referenceTotal: Pence; checkedAt: string };
  /** Set when the price came from the location tariff instead of a reference fare. */
  tariff?: { version: string; events: string[] };
  /** Things the operator should check, e.g. a price matched on postcode only. */
  reviewFlags?: string[];
}

export interface FieldError {
  /** Dotted path of the field, e.g. "terminal" or "customer.email". */
  field: string;
  code: string;
  message: string;
}
