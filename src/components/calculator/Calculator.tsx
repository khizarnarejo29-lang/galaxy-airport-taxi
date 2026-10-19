"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, type ComponentType } from "react";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { errorMessages } from "@/lib/domain/errors";
import type { AirportCode, Direction, FieldError } from "@/lib/domain/types";
import { formatGBP } from "@/lib/utils/money";
import { requestQuote, submitBooking } from "./api";
import {
  addressLines,
  emptyDraft,
  fieldId,
  reducer,
  selectedOption,
  STEPS,
  stepsFor,
  stepForErrors,
  toJourneyInput,
  validateStep,
  type CalcState,
  type Draft,
  type QuoteState,
  type StepId,
} from "./state";
import {
  AirportStep,
  DetailsStep,
  ExtrasStep,
  JourneyStep,
  PartyStep,
  ReviewStep,
  VehicleStep,
  WhenStep,
  reviewSections,
  type StepProps,
} from "./steps";
import { whatsappBookingLink } from "./whatsapp-booking";

// v4: pickup and drop-off, each an address or an airport.
const STORAGE_KEY = "gat:calculator:v4";

const STEP_COMPONENTS: Record<StepId, ComponentType<StepProps>> = {
  journey: JourneyStep,
  when: WhenStep,
  party: PartyStep,
  airport: AirportStep,
  extras: ExtrasStep,
  vehicle: VehicleStep,
  details: DetailsStep,
  review: ReviewStep,
};

const NEEDS_QUOTE: StepId[] = ["vehicle", "details", "review"];

interface Props {
  /** Pre-select an airport (e.g. on an airport landing page): the drop-off, or the pickup when coming from the airport. */
  initialAirport?: AirportCode;
  initialDirection?: Direction;
  /** "hero": the page has its own <h1>, so step titles are <h2>. "page": step titles are the <h1>. */
  variant?: "hero" | "page";
}

function focusField(errors: FieldError[]) {
  const first = errors[0];
  if (!first) return;
  requestAnimationFrame(() => {
    const id = fieldId(first.field);
    const el =
      document.getElementById(`${id}-input`) ??
      document.getElementById(id) ??
      document.getElementById(fieldId(first.field.split(".")[0]));
    el?.focus({ preventScroll: false });
  });
}

/** The starting journey for a page: to the airport unless the page says otherwise. */
function initialDraft(airport?: AirportCode, direction?: Direction): Draft {
  return direction === "from_airport"
    ? { ...emptyDraft, pickupKind: "airport", pickupAirport: airport ?? null, dropoffKind: "address" }
    : { ...emptyDraft, dropoffAirport: airport ?? null };
}

export function Calculator({ initialAirport, initialDirection, variant = "page" }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, (): CalcState => ({
    step: "journey",
    draft: initialDraft(initialAirport, initialDirection),
    errors: [],
    quote: null,
    busy: null,
    notice: null,
    hydrated: false,
  }));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stepChanged = useRef(false);

  // Restore an in-progress quote after refresh or navigation.
  useEffect(() => {
    let saved: Pick<CalcState, "step" | "draft" | "quote"> | undefined;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Pick<CalcState, "step" | "draft" | "quote">;
        const quote = parsed.quote && new Date(parsed.quote.quote.expiresAt) > new Date() ? parsed.quote : null;
        const draft: Draft = { ...emptyDraft, ...parsed.draft };
        // An airport page pre-selects its airport on the journey's airport end, unless the visitor is past the first step.
        const end = draft.pickupKind === "airport" ? "pickupAirport" : draft.dropoffKind === "airport" ? "dropoffAirport" : null;
        if (initialAirport && end && (parsed.step === "journey" || !draft[end]) && draft[end] !== initialAirport) {
          draft[end] = initialAirport;
          draft.terminal = "";
          draft.returnTerminal = "";
        }
        saved = { step: parsed.step, draft, quote };
      }
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
    dispatch({ type: "restore", state: saved });
  }, [initialAirport]);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step: state.step, draft: state.draft, quote: state.quote }));
    } catch {
      /* ignore */
    }
  }, [state.hydrated, state.step, state.draft, state.quote]);

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (!stepChanged.current) return;
    stepChanged.current = false;
    headingRef.current?.focus({ preventScroll: true });
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.step]);

  const go = useCallback((step: StepId) => {
    stepChanged.current = true;
    dispatch({ type: "go", step });
  }, []);

  const set = useCallback((patch: Partial<Draft>) => dispatch({ type: "set", patch }), []);

  const fail = useCallback(
    (errors: FieldError[]) => {
      const step = stepForErrors(errors);
      if (step && step !== state.step) stepChanged.current = true;
      dispatch({ type: "errors", errors, step });
      focusField(errors);
    },
    [state.step],
  );

  const fetchQuote = useCallback(
    async (draft: Draft, notice?: string): Promise<QuoteState | null> => {
      dispatch({ type: "busy", busy: "quote" });
      const res = await requestQuote(toJourneyInput(draft));
      if (!res.ok) {
        fail(res.errors);
        return null;
      }
      const quote = { quote: res.quote, token: res.token, cardPayments: res.cardPayments, onlineBooking: res.onlineBooking };
      dispatch({ type: "quoted", quote, notice });
      return quote;
    },
    [fail],
  );

  // A restored session or an edit may leave a later step without a live quote.
  useEffect(() => {
    if (NEEDS_QUOTE.includes(state.step) && !state.quote && !state.busy && state.errors.length === 0) {
      void fetchQuote(state.draft);
    }
  }, [state.step, state.quote, state.busy, state.errors.length, state.draft, fetchQuote]);

  async function submit() {
    const { draft, quote } = state;
    const option = selectedOption(draft, quote);
    if (!quote || !option?.available) return;
    dispatch({ type: "busy", busy: "booking" });
    const res = await submitBooking({
      quoteToken: quote.token,
      vehicleId: option.vehicleId,
      addOns: draft.addOns,
      customer: draft.customer,
      // House number and street for each address end of this journey only.
      ...Object.fromEntries(addressLines(draft).map(({ field }) => [field, draft[field]])),
      specialRequirements: draft.specialRequirements || undefined,
      notes: draft.notes || undefined,
      // Only echoes the server's signed figure back so a changed price is caught; the server sets the price.
      expectedTotal: option.total,
    });
    if (res.ok) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      // Card payments: on to the secure card page. Otherwise straight to the confirmation.
      if (res.checkoutUrl) window.location.assign(res.checkoutUrl);
      else router.push(`/booking/${res.reference}`);
      return;
    }
    const code = res.errors[0]?.code;
    if (code === "QUOTE_EXPIRED" || code === "PRICE_CHANGED" || code === "FARE_UNAVAILABLE") {
      const fresh = await fetchQuote(draft, errorMessages[code]);
      // The chosen vehicle may no longer have a price: show the refreshed options.
      if (fresh && !selectedOption(draft, fresh)?.available) go("vehicle");
      return;
    }
    if (stepForErrors(res.errors)) fail(res.errors);
    else dispatch({ type: "errors", errors: res.errors });
  }

  async function next() {
    const errors = validateStep(state.step, state.draft, state.quote);
    if (errors.length) {
      fail(errors);
      return;
    }
    const steps = stepsFor(state.draft);
    const index = steps.findIndex((s) => s.id === state.step);
    if (state.step === "extras") {
      if (state.quote || (await fetchQuote(state.draft))) go("vehicle");
      return;
    }
    if (state.step === "review") {
      // While bookings can't be saved, the booking goes to the office on WhatsApp instead.
      if (whatsappLink) {
        window.open(whatsappLink, "_blank", "noopener");
        return;
      }
      await submit();
      return;
    }
    go(steps[index + 1].id);
  }

  // The airport step only appears for journeys that use an airport.
  const steps = stepsFor(state.draft);
  const found = steps.findIndex((s) => s.id === state.step);
  const index = Math.max(found, 0);
  const current = STEPS.find((s) => s.id === state.step)!;
  const StepBody = STEP_COMPONENTS[state.step];
  const generalErrors = state.errors.filter((e) => !stepForErrors([e]));
  // Shown only from the server's quote, never worked out in the browser.
  const chosen = selectedOption(state.draft, state.quote);
  const runningTotal = chosen?.available && NEEDS_QUOTE.includes(state.step) ? chosen.total : null;
  const whatsappLink =
    state.step === "review" && state.quote?.onlineBooking === false && chosen?.available
      ? whatsappBookingLink(reviewSections(state.draft, state.quote, chosen), chosen)
      : null;
  const nothingPriced =
    state.step === "vehicle" && state.quote !== null && !state.quote.quote.options.some((o) => o.available);

  const primaryLabel =
    state.step === "extras"
      ? "Get my prices"
      : state.step === "review"
        ? whatsappLink
          ? "Book on WhatsApp"
          : state.quote?.cardPayments && runningTotal !== null
          ? `Confirm and pay ${formatGBP(runningTotal)}`
          : "Confirm booking"
        : "Continue";
  const busyLabel =
    state.busy === "quote" ? "Calculating…" : state.busy === "booking" ? (state.quote?.cardPayments ? "Opening payment…" : "Booking…") : null;
  const HeadingTag = variant === "hero" ? "h2" : "h1";

  return (
    <div
      ref={rootRef}
      data-calculator
      data-step={state.step}
      className={
        "scroll-mt-20 overflow-clip rounded-2xl bg-white text-ink shadow-card ring-1 ring-navy-900/5 sm:rounded-3xl " +
        // Focused fields keep room below them for their error message and the sticky action bar,
        // and room above for the site header.
        "[&_:is(input,textarea,button,fieldset,output)]:scroll-mt-28 [&_:is(input,textarea,button,fieldset,output)]:scroll-mb-44"
      }
      aria-busy={state.busy !== null}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!state.busy) void next();
        }}
      >
        {/* Progress */}
        <div className="px-5 pt-5 sm:px-8 sm:pt-7">
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
            <span>
              Step {index + 1} of {steps.length}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-accent-strong">{current.title}</span>
          </p>
          <div
            className="mt-3 flex gap-1"
            role="progressbar"
            aria-label="Booking progress"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={index + 1}
            aria-valuetext={`Step ${index + 1} of ${steps.length}: ${current.title}`}
          >
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={
                  "h-1 flex-1 rounded-full transition-colors duration-500 " +
                  (i < index ? "bg-ink" : i === index ? "bg-accent" : "bg-line")
                }
              />
            ))}
          </div>
          <HeadingTag
            ref={headingRef}
            tabIndex={-1}
            data-calculator-heading
            className="mt-6 font-display text-[1.65rem] leading-tight font-semibold tracking-tight outline-none sm:text-3xl"
          >
            {current.title}
          </HeadingTag>
        </div>

        {/* Body */}
        <div key={state.step} className="px-5 pt-6 pb-7 animate-step-in sm:px-8">
          {state.notice && (
            <p
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm font-medium text-ink"
            >
              <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-accent-strong" />
              {state.notice}
            </p>
          )}
          {generalErrors.length > 0 && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                {generalErrors.map((e) => (
                  <p key={e.code}>{e.message}</p>
                ))}
                {generalErrors.some((e) => ["LOCATION_LOOKUP_FAILED", "SERVER_ERROR"].includes(e.code)) && (
                  <p>
                    You can also book by phone on{" "}
                    <a className="font-semibold underline underline-offset-2" href={site.phone.href}>
                      {site.phone.display}
                    </a>
                    .
                  </p>
                )}
              </div>
            </div>
          )}
          <StepBody state={state} set={set} go={go} />
        </div>

        {/* Action bar — sticks to the bottom of the screen on mobile while the card is in view. */}
        <div className="sticky bottom-0 z-20 border-t border-line bg-white/95 px-5 py-3.5 backdrop-blur sm:px-8 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(steps[index - 1].id)}
                disabled={state.busy !== null}
                className={
                  "inline-flex h-14 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-4 " +
                  "text-base font-semibold text-ink transition hover:border-ink hover:bg-surface disabled:opacity-50 sm:px-5"
                }
              >
                <Icon name="arrowLeft" className="size-5" />
                Back
              </button>
            )}
            {runningTotal !== null && (
              <div className="min-w-0 shrink-0" aria-live="polite">
                <p className="text-xs text-ink-soft">Total</p>
                <p className="font-display text-xl font-semibold tabular-nums">{formatGBP(runningTotal)}</p>
              </div>
            )}
            {nothingPriced ? (
              <a
                href={site.phone.href}
                className="inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-base font-bold text-white transition hover:bg-night-3 sm:px-6"
              >
                <Icon name="phone" className="size-5 shrink-0" />
                <span className="truncate">Call {site.phone.display}</span>
              </a>
            ) : (
              <button
                type="submit"
                disabled={state.busy !== null}
                className={
                  "inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-base font-bold text-white " +
                  "transition hover:bg-night-3 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80 sm:px-6"
                }
              >
                {busyLabel && (
                  <span
                    className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{busyLabel ?? primaryLabel}</span>
                {!busyLabel && <Icon name={state.step === "review" ? "check" : "arrowRight"} className="size-5 shrink-0" />}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
