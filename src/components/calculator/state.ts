import { requiresTerminal } from "@/lib/domain/airports";
import { fieldError } from "@/lib/domain/errors";
import { meetAndGreetAllowed } from "@/lib/domain/route";
import type {
  AddOns,
  AirportCode,
  Customer,
  FieldError,
  JourneyEndInput,
  JourneyInput,
  Quote,
  QuoteOption,
  LuggageCategory,
  ResolvedLocation,
  TripType,
  VehicleId,
} from "@/lib/domain/types";
import {
  validateAirportStep,
  validateBookingDetails,
  validateJourneyStep,
  validateReferencePartyStep,
  validateReturnJourney,
  validateWhenStep,
} from "@/lib/domain/validation";
import { bookingRules } from "@/config/booking-rules";

export const STEPS = [
  { id: "journey", title: "Your journey" },
  { id: "when", title: "Date and time" },
  { id: "party", title: "Passengers and luggage" },
  { id: "airport", title: "Airport details" },
  { id: "extras", title: "Extras" },
  { id: "vehicle", title: "Choose your vehicle" },
  { id: "details", title: "Your details" },
  { id: "review", title: "Review and book" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/** Each end of a journey is an address found by postcode search, or an airport. */
export type EndKind = "address" | "airport";

export interface Draft {
  tripType: TripType;
  pickupKind: EndKind;
  pickupAddress: ResolvedLocation | null;
  pickupAirport: AirportCode | null;
  dropoffKind: EndKind;
  dropoffAddress: ResolvedLocation | null;
  dropoffAirport: AirportCode | null;
  extraStops: (ResolvedLocation | null)[];
  /**
   * The way back starts at the outward drop-off unless this is set, and always
   * ends at the outward pickup. "Somewhere else" is always another address.
   */
  returnFromDifferentAddress: boolean;
  returnPickupAddress: ResolvedLocation | null;
  returnExtraStops: (ResolvedLocation | null)[];
  date: string;
  time: string;
  returnDate: string;
  returnTime: string;
  passengers: number | null;
  /** None, hand luggage or suitcases; null until the customer chooses. With both, this is "suitcases". */
  luggageCategory: LuggageCategory | null;
  /** Hand luggage chosen as well as suitcases. */
  handLuggageToo: boolean;
  /** How many hand luggage bags and suitcases, used only for the kinds chosen. */
  handLuggageCount: number;
  suitcaseCount: number;
  /** Large or unusual items (bikes, golf bags…); null until answered. Yes means price on request. */
  largeItems: boolean | null;
  /** Terminal of the outward journey's airport end (a journey never has two airports). */
  terminal: string;
  flightNumber: string;
  /** Terminal to collect from on the way back, when the return starts at the airport. */
  returnTerminal: string;
  returnFlightNumber: string;
  vehicleId: VehicleId | null;
  addOns: AddOns;
  customer: Customer;
  pickupLine1: string;
  dropoffLine1: string;
  returnPickupLine1: string;
  specialRequirements: string;
  notes: string;
}

export interface QuoteState {
  quote: Quote;
  token: string;
  /** Booking is followed by the card payment page. */
  cardPayments?: boolean;
  /** False: bookings can't be saved right now, so the booking is sent on WhatsApp instead. */
  onlineBooking?: boolean;
}

export interface CalcState {
  step: StepId;
  draft: Draft;
  errors: FieldError[];
  quote: QuoteState | null;
  busy: "quote" | "booking" | null;
  /** One-off message shown above the step, e.g. "your quote was refreshed". */
  notice: string | null;
  /** True once any saved session has been restored; nothing is saved before that. */
  hydrated: boolean;
}

export const emptyDraft: Draft = {
  tripType: "one_way",
  pickupKind: "address",
  pickupAddress: null,
  pickupAirport: null,
  dropoffKind: "airport",
  dropoffAddress: null,
  dropoffAirport: null,
  extraStops: [],
  returnFromDifferentAddress: false,
  returnPickupAddress: null,
  returnExtraStops: [],
  date: "",
  time: "",
  returnDate: "",
  returnTime: "",
  passengers: null,
  luggageCategory: null,
  handLuggageToo: false,
  handLuggageCount: 1,
  suitcaseCount: 1,
  largeItems: null,
  terminal: "",
  flightNumber: "",
  returnTerminal: "",
  returnFlightNumber: "",
  vehicleId: null,
  addOns: { meetAndGreet: false, childSeats: 0 },
  customer: { name: "", email: "", phone: "" },
  pickupLine1: "",
  dropoffLine1: "",
  returnPickupLine1: "",
  specialRequirements: "",
  notes: "",
};

/** Changing any of these invalidates the current quote. */
const PRICED_FIELDS: (keyof Draft)[] = [
  "tripType",
  "pickupKind",
  "pickupAddress",
  "pickupAirport",
  "dropoffKind",
  "dropoffAddress",
  "dropoffAirport",
  "extraStops",
  "returnFromDifferentAddress",
  "returnPickupAddress",
  "returnExtraStops",
  "date",
  "time",
  "returnDate",
  "returnTime",
  "passengers",
  "luggageCategory",
  "handLuggageToo",
  "handLuggageCount",
  "suitcaseCount",
  "largeItems",
  "terminal",
  "flightNumber",
  "returnTerminal",
  "returnFlightNumber",
  "addOns",
];

/** Fields that decide which airport (if any) the journey uses: changing one resets the terminals. */
const AIRPORT_FIELDS: (keyof Draft)[] = ["pickupKind", "pickupAirport", "dropoffKind", "dropoffAirport"];

/** Error fields an edit can make stale, beyond the field itself. Route errors can come from either end. */
const ROUTE_ERRORS = ["pickup", "dropoff", "extraStops", "returnJourney.pickup", "returnJourney.extraStops"];
const RELATED_ERRORS: Partial<Record<keyof Draft, string[]>> = {
  pickupKind: ROUTE_ERRORS,
  pickupAddress: ROUTE_ERRORS,
  pickupAirport: ROUTE_ERRORS,
  dropoffKind: ROUTE_ERRORS,
  dropoffAddress: ROUTE_ERRORS,
  dropoffAirport: ROUTE_ERRORS,
  extraStops: ["extraStops"],
  terminal: ["pickup.terminal", "dropoff.terminal"],
};

export type Action =
  | { type: "set"; patch: Partial<Draft> }
  | { type: "go"; step: StepId }
  | { type: "errors"; errors: FieldError[]; step?: StepId }
  | { type: "busy"; busy: CalcState["busy"] }
  | { type: "quoted"; quote: QuoteState; notice?: string }
  | { type: "notice"; notice: string | null }
  | { type: "restore"; state?: Pick<CalcState, "step" | "draft" | "quote"> };

const under = (field: string, prefix: string) => field === prefix || field.startsWith(`${prefix}.`);

export function reducer(state: CalcState, action: Action): CalcState {
  switch (action.type) {
    case "set": {
      const keys = Object.keys(action.patch) as (keyof Draft)[];
      const draft = { ...state.draft, ...action.patch };
      // Terminal choices belong to one airport.
      if (AIRPORT_FIELDS.some((k) => k in action.patch && action.patch[k] !== state.draft[k])) {
        draft.terminal = "";
        draft.returnTerminal = "";
      }
      const repriced = keys.some((k) => PRICED_FIELDS.includes(k));
      const touched = (e: FieldError) =>
        keys.some(
          (k) =>
            under(e.field, k) ||
            (RELATED_ERRORS[k] ?? []).some((p) => under(e.field, p)) ||
            (k.startsWith("return") && e.field.startsWith("returnJourney")),
        );
      return {
        ...state,
        draft,
        errors: state.errors.filter((e) => !touched(e)),
        quote: repriced ? null : state.quote,
        notice: repriced ? null : state.notice,
      };
    }
    case "go":
      return { ...state, step: action.step, errors: [], notice: null };
    case "errors":
      return { ...state, errors: action.errors, step: action.step ?? state.step, busy: null };
    case "busy":
      return { ...state, busy: action.busy };
    case "quoted": {
      const available = new Set(action.quote.quote.options.filter((o) => o.available).map((o) => o.vehicleId));
      const vehicleId = state.draft.vehicleId && available.has(state.draft.vehicleId) ? state.draft.vehicleId : null;
      return {
        ...state,
        quote: action.quote,
        draft: { ...state.draft, vehicleId },
        busy: null,
        errors: [],
        notice: action.notice ?? null,
      };
    }
    case "notice":
      return { ...state, notice: action.notice };
    case "restore":
      // Idempotent: React may run the restoring effect twice in development.
      return state.hydrated ? state : { ...state, ...action.state, hydrated: true };
  }
}

export const isReturn = (d: Pick<Draft, "tripType">) => d.tripType === "return";

/** The airport end of the outward journey, if it has one. */
export function outwardAirport(d: Draft): AirportCode | null {
  if (d.pickupKind === "airport") return d.pickupAirport;
  if (d.dropoffKind === "airport") return d.dropoffAirport;
  return null;
}

/** True when the way back starts at the airport the outward journey went to. */
export const returnPicksUpAtAirport = (d: Draft) =>
  isReturn(d) && d.dropoffKind === "airport" && !d.returnFromDifferentAddress;

/** Airport details are only asked for when the journey uses an airport. */
export const hasAirport = (d: Draft) => d.pickupKind === "airport" || d.dropoffKind === "airport";

/** The steps this journey goes through, in order. */
export const stepsFor = (d: Draft) => STEPS.filter((s) => s.id !== "airport" || hasAirport(d));

const end = (kind: EndKind, address: ResolvedLocation | null, airport: AirportCode | null, terminal: string, line1: string): JourneyEndInput =>
  kind === "airport"
    ? { kind, airport: airport!, terminal: terminal || undefined }
    : // Once known, the house details are priced too, so a refreshed quote can't reuse another address's fare.
      { kind, locationId: address?.id ?? "", line1: line1.trim() || undefined };

const stops = (list: (ResolvedLocation | null)[]) => list.map((s) => ({ locationId: s?.id ?? "" }));

/** Where the way back starts: the outward drop-off (another terminal there, for an airport), or another address. */
function returnPickup(d: Draft): JourneyEndInput {
  if (d.returnFromDifferentAddress) return end("address", d.returnPickupAddress, null, "", d.returnPickupLine1);
  return end(d.dropoffKind, d.dropoffAddress, d.dropoffAirport, d.returnTerminal, d.dropoffLine1);
}

const outwardPickup = (d: Draft) => end(d.pickupKind, d.pickupAddress, d.pickupAirport, d.terminal, d.pickupLine1);

/** Meet & Greet needs an airport pickup on at least one leg. */
export const meetAndGreetAvailable = (d: Draft) =>
  meetAndGreetAllowed({ pickup: outwardPickup(d), returnJourney: isReturn(d) ? { pickup: returnPickup(d) } : undefined });

/** A leg with an airport at either end has a flight; the way back ends at the outward pickup. */
export const returnHasAirport = (d: Draft) => d.pickupKind === "airport" || returnPicksUpAtAirport(d);

export function toJourneyInput(d: Draft): JourneyInput {
  return {
    pickup: outwardPickup(d),
    dropoff: end(d.dropoffKind, d.dropoffAddress, d.dropoffAirport, d.terminal, d.dropoffLine1),
    extraStops: stops(d.extraStops),
    date: d.date,
    time: d.time,
    passengers: d.passengers,
    flightNumber: (hasAirport(d) && d.flightNumber.trim()) || undefined,
    tripType: d.tripType,
    returnJourney: isReturn(d)
      ? {
          pickup: returnPickup(d),
          extraStops: stops(d.returnExtraStops),
          date: d.returnDate,
          time: d.returnTime,
          flightNumber: (returnHasAirport(d) && d.returnFlightNumber.trim()) || undefined,
        }
      : undefined,
    luggageCategory: d.luggageCategory ?? undefined,
    handLuggageToo: (d.luggageCategory === "suitcases" && d.handLuggageToo) || undefined,
    luggageCounts: luggageCountsFor(d),
    largeItems: d.largeItems ?? undefined,
    extras: { meetAndGreet: meetAndGreetAvailable(d) && d.addOns.meetAndGreet, childSeats: d.addOns.childSeats },
  };
}

/** The server-priced option for the chosen vehicle, if any. */
export function selectedOption(d: Draft, quote: QuoteState | null): QuoteOption | undefined {
  return quote?.quote.options.find((o) => o.vehicleId === d.vehicleId);
}

const returnErrors = (d: Draft, fields: RegExp) =>
  isReturn(d) ? validateReturnJourney(toJourneyInput(d)).filter((e) => fields.test(e.field)) : [];

/** House number and street for every address end. A return from the outward drop-off reuses its address. */
export function addressLines(d: Draft): { field: "pickupLine1" | "dropoffLine1" | "returnPickupLine1"; location: ResolvedLocation | null }[] {
  return [
    ...(d.pickupKind === "address" ? [{ field: "pickupLine1" as const, location: d.pickupAddress }] : []),
    ...(d.dropoffKind === "address" ? [{ field: "dropoffLine1" as const, location: d.dropoffAddress }] : []),
    ...(isReturn(d) && d.returnFromDifferentAddress ? [{ field: "returnPickupLine1" as const, location: d.returnPickupAddress }] : []),
  ];
}

/** Client-side checks for one step (the server re-checks everything). */
export function validateStep(step: StepId, d: Draft, quote: QuoteState | null): FieldError[] {
  const input = toJourneyInput(d);
  switch (step) {
    case "journey":
      return [...validateJourneyStep(input), ...returnErrors(d, /^returnJourney\.(pickup|extraStops(\.\d+)?)$/)];
    case "when":
      return [...validateWhenStep(input), ...returnErrors(d, /^returnJourney\.(date|time)$/)];
    case "party":
      return validateReferencePartyStep(input);
    case "airport":
      return [...validateAirportStep(input), ...returnErrors(d, /^returnJourney\.(pickup\.terminal|flightNumber)$/)];
    case "extras": {
      const seats = d.addOns.childSeats;
      return Number.isInteger(seats) && seats >= 0 && seats <= bookingRules.maxChildSeats
        ? []
        : [fieldError("addOns.childSeats", "CHILD_SEATS_INVALID", { max: bookingRules.maxChildSeats })];
    }
    case "vehicle": {
      if (!d.vehicleId) return [fieldError("vehicleId", "VEHICLE_REQUIRED")];
      return selectedOption(d, quote)?.available ? [] : [fieldError("vehicleId", "VEHICLE_UNAVAILABLE")];
    }
    case "details":
      return validateBookingDetails({
        customer: d.customer,
        addressLines: addressLines(d).map(({ field }) => ({ field, value: d[field] })),
        addOns: d.addOns,
        specialRequirements: d.specialRequirements,
        notes: d.notes,
      }).filter((e) => !e.field.startsWith("addOns"));
    case "review":
      return [];
  }
}

/** Which step owns each error field, matched against the whole dotted path. */
const FIELD_STEPS: [RegExp, StepId][] = [
  [/^(tripType|pickup|dropoff)$|^extraStops(\.\d+)?$|^returnJourney(\.(pickup|extraStops(\.\d+)?))?$/, "journey"],
  [/^(date|time)$|^returnJourney\.(date|time)$/, "when"],
  [/^(passengers|luggage|luggageCategory|luggageCounts|largeItems)(\.|$)/, "party"],
  [/^(pickup|dropoff)\.terminal$|^flightNumber$|^returnJourney\.(pickup\.terminal|flightNumber)$/, "airport"],
  [/^(addOns|extras)(\.|$)/, "extras"],
  [/^vehicleId$/, "vehicle"],
  [/^(customer|pickupLine1|dropoffLine1|returnPickupLine1|specialRequirements|notes)(\.|$)/, "details"],
];

/** The earliest step that owns one of these errors. */
export function stepForErrors(errors: FieldError[]): StepId | undefined {
  const order = STEPS.map((s) => s.id);
  const steps = errors
    .map((e) => FIELD_STEPS.find(([re]) => re.test(e.field))?.[1])
    .filter((s): s is StepId => Boolean(s));
  return steps.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
}

export const fieldId = (field: string) => `calc-${field.replace(/\./g, "-")}`;

export function errorFor(errors: FieldError[], field: string): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function needsTerminal(airport: AirportCode | null): boolean {
  return airport ? requiresTerminal(airport) : false;
}

/* ───────────────────────── Luggage choice ───────────────────────── */

export type LuggageItem = "none" | "hand_luggage" | "suitcases";

/** Which luggage cards show as chosen. Hand luggage and suitcases can be chosen together. */
export function chosenLuggage(d: Pick<Draft, "luggageCategory" | "handLuggageToo">): Record<LuggageItem, boolean> {
  const suitcases = d.luggageCategory === "suitcases";
  return {
    none: d.luggageCategory === "none",
    hand_luggage: d.luggageCategory === "hand_luggage" || (suitcases && d.handLuggageToo),
    suitcases,
  };
}

/**
 * Tapping a luggage card. "None" clears the others; hand luggage and suitcases
 * toggle independently. The price follows the biggest item: suitcases, then
 * hand luggage, so choosing both is priced exactly as suitcases.
 */
export function toggleLuggage(
  d: Pick<Draft, "luggageCategory" | "handLuggageToo">,
  item: LuggageItem,
): Pick<Draft, "luggageCategory" | "handLuggageToo"> {
  if (item === "none") return { luggageCategory: "none", handLuggageToo: false };
  const now = chosenLuggage(d);
  const hand = item === "hand_luggage" ? !now.hand_luggage : now.hand_luggage;
  const suitcases = item === "suitcases" ? !now.suitcases : now.suitcases;
  if (suitcases) return { luggageCategory: "suitcases", handLuggageToo: hand };
  if (hand) return { luggageCategory: "hand_luggage", handLuggageToo: false };
  return { luggageCategory: null, handLuggageToo: false };
}

/** The counts to send: one for each kind of luggage chosen. */
export function luggageCountsFor(d: Pick<Draft, "luggageCategory" | "handLuggageToo" | "handLuggageCount" | "suitcaseCount">) {
  const chosen = chosenLuggage(d);
  if (!chosen.hand_luggage && !chosen.suitcases) return undefined;
  return {
    ...(chosen.hand_luggage ? { handLuggage: d.handLuggageCount } : {}),
    ...(chosen.suitcases ? { suitcases: d.suitcaseCount } : {}),
  };
}
