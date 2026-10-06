import { requiresTerminal } from "@/lib/domain/airports";
import { fieldError } from "@/lib/domain/errors";
import type {
  AddOns,
  AirportCode,
  Customer,
  Direction,
  FieldError,
  JourneyInput,
  Quote,
  ResolvedLocation,
  VehicleId,
} from "@/lib/domain/types";
import {
  validateAirportStep,
  validateBookingDetails,
  validateJourneyStep,
  validatePartyStep,
  validateWhenStep,
} from "@/lib/domain/validation";

export const STEPS = [
  { id: "journey", title: "Your journey" },
  { id: "when", title: "Date and time" },
  { id: "party", title: "Passengers and luggage" },
  { id: "airport", title: "Airport details" },
  { id: "vehicle", title: "Choose your vehicle" },
  { id: "details", title: "Your details" },
  { id: "review", title: "Review and book" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export interface Draft {
  direction: Direction;
  airport: AirportCode | null;
  address: ResolvedLocation | null;
  extraStops: (ResolvedLocation | null)[];
  date: string;
  time: string;
  passengers: number | null;
  luggage: { large: number; small: number };
  terminal: string;
  flightNumber: string;
  vehicleId: VehicleId | null;
  addOns: AddOns;
  customer: Customer;
  addressLine1: string;
  addressPostcode: string;
  specialRequirements: string;
  notes: string;
}

export interface QuoteState {
  quote: Quote;
  token: string;
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
  direction: "to_airport",
  airport: null,
  address: null,
  extraStops: [],
  date: "",
  time: "",
  passengers: null,
  luggage: { large: 0, small: 0 },
  terminal: "",
  flightNumber: "",
  vehicleId: null,
  addOns: { meetAndGreet: false, childSeats: 0 },
  customer: { name: "", email: "", phone: "" },
  addressLine1: "",
  addressPostcode: "",
  specialRequirements: "",
  notes: "",
};

/** Changing any of these invalidates the current quote. */
const PRICED_FIELDS: (keyof Draft)[] = [
  "direction",
  "airport",
  "address",
  "extraStops",
  "date",
  "time",
  "passengers",
  "luggage",
  "terminal",
  "flightNumber",
];

export type Action =
  | { type: "set"; patch: Partial<Draft> }
  | { type: "go"; step: StepId }
  | { type: "errors"; errors: FieldError[]; step?: StepId }
  | { type: "busy"; busy: CalcState["busy"] }
  | { type: "quoted"; quote: QuoteState; notice?: string }
  | { type: "notice"; notice: string | null }
  | { type: "restore"; state?: Pick<CalcState, "step" | "draft" | "quote"> };

export function reducer(state: CalcState, action: Action): CalcState {
  switch (action.type) {
    case "set": {
      const keys = Object.keys(action.patch) as (keyof Draft)[];
      const draft = { ...state.draft, ...action.patch };
      // Terminal choices belong to one airport.
      if (action.patch.airport && action.patch.airport !== state.draft.airport) draft.terminal = "";
      const repriced = keys.some((k) => PRICED_FIELDS.includes(k));
      const touched = (e: FieldError) =>
        keys.some((k) => e.field === k || e.field.startsWith(`${k}.`) || (k === "address" && e.field === "addressPostcode"));
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

export function toJourneyInput(d: Draft): JourneyInput {
  return {
    direction: d.direction,
    airport: d.airport!,
    terminal: d.terminal || undefined,
    address: { locationId: d.address?.id ?? "" },
    extraStops: d.extraStops.map((s) => ({ locationId: s?.id ?? "" })),
    date: d.date,
    time: d.time,
    passengers: d.passengers,
    luggage: d.luggage,
    flightNumber: d.flightNumber.trim() || undefined,
  };
}

/** Client-side checks for one step (the server re-checks everything). */
export function validateStep(step: StepId, d: Draft, quote: QuoteState | null): FieldError[] {
  const input = { ...toJourneyInput(d), airport: d.airport ?? undefined };
  switch (step) {
    case "journey":
      return validateJourneyStep(input);
    case "when":
      return validateWhenStep(input);
    case "party":
      return validatePartyStep(input);
    case "airport":
      return validateAirportStep(input);
    case "vehicle": {
      if (!d.vehicleId) return [fieldError("vehicleId", "VEHICLE_REQUIRED")];
      const option = quote?.quote.options.find((o) => o.vehicleId === d.vehicleId);
      return option?.available ? [] : [fieldError("vehicleId", "VEHICLE_UNAVAILABLE")];
    }
    case "details":
      return validateBookingDetails({
        customer: d.customer,
        addressLine1: d.addressLine1,
        addressPostcode: d.addressPostcode,
        needsPostcode: d.address?.kind === "place",
        addOns: d.addOns,
        specialRequirements: d.specialRequirements,
        notes: d.notes,
      });
    case "review":
      return [];
  }
}

/** Matched against the first segment of a field path ("customer.email" → "customer"). */
const FIELD_STEPS: [RegExp, StepId][] = [
  [/^(direction|airport|address|extraStops)$/, "journey"],
  [/^(date|time)$/, "when"],
  [/^(passengers|luggage)$/, "party"],
  [/^(terminal|flightNumber)$/, "airport"],
  [/^vehicleId$/, "vehicle"],
  [/^(customer|addressLine1|addressPostcode|addOns|specialRequirements|notes)$/, "details"],
];

/** The earliest step that owns one of these errors. */
export function stepForErrors(errors: FieldError[]): StepId | undefined {
  const order = STEPS.map((s) => s.id);
  const steps = errors
    .map((e) => FIELD_STEPS.find(([re]) => re.test(e.field.split(".")[0]))?.[1])
    .filter((s): s is StepId => Boolean(s));
  return steps.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
}

export const fieldId = (field: string) => `calc-${field.replace(/\./g, "-")}`;

export function errorFor(errors: FieldError[], field: string): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function needsTerminal(d: Draft): boolean {
  return d.airport ? requiresTerminal(d.airport) : false;
}
