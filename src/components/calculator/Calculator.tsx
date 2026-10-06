"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, type ComponentType } from "react";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { errorMessages } from "@/lib/domain/errors";
import type { AirportCode, Direction, FieldError } from "@/lib/domain/types";
import { formatGBP } from "@/lib/utils/money";
import { requestQuote, submitBooking } from "./api";
import { priceWithAddOns } from "./pricing";
import {
  emptyDraft,
  fieldId,
  reducer,
  STEPS,
  stepForErrors,
  toJourneyInput,
  validateStep,
  type CalcState,
  type Draft,
  type StepId,
} from "./state";
import {
  AirportStep,
  DetailsStep,
  JourneyStep,
  PartyStep,
  ReviewStep,
  VehicleStep,
  WhenStep,
  type StepProps,
} from "./steps";

const STORAGE_KEY = "gat:calculator:v1";

const STEP_COMPONENTS: Record<StepId, ComponentType<StepProps>> = {
  journey: JourneyStep,
  when: WhenStep,
  party: PartyStep,
  airport: AirportStep,
  vehicle: VehicleStep,
  details: DetailsStep,
  review: ReviewStep,
};

const NEEDS_QUOTE: StepId[] = ["vehicle", "details", "review"];

interface Props {
  /** Pre-select an airport (e.g. on an airport landing page). */
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

export function Calculator({ initialAirport, initialDirection, variant = "page" }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, (): CalcState => ({
    step: "journey",
    draft: {
      ...emptyDraft,
      airport: initialAirport ?? null,
      direction: initialDirection ?? emptyDraft.direction,
    },
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
        // An airport page pre-selects its airport unless the visitor is already past the first step.
        if (initialAirport && (parsed.step === "journey" || !draft.airport) && draft.airport !== initialAirport) {
          draft.airport = initialAirport;
          draft.terminal = "";
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
    async (draft: Draft, notice?: string): Promise<boolean> => {
      dispatch({ type: "busy", busy: "quote" });
      const res = await requestQuote(toJourneyInput(draft));
      if (!res.ok) {
        fail(res.errors);
        return false;
      }
      dispatch({ type: "quoted", quote: { quote: res.quote, token: res.token }, notice });
      return true;
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
    if (!quote || !draft.vehicleId) return;
    dispatch({ type: "busy", busy: "booking" });
    const res = await submitBooking({
      quoteToken: quote.token,
      vehicleId: draft.vehicleId,
      addOns: draft.addOns,
      customer: draft.customer,
      addressLine1: draft.addressLine1,
      addressPostcode: draft.address?.kind === "place" ? draft.addressPostcode : undefined,
      specialRequirements: draft.specialRequirements || undefined,
      notes: draft.notes || undefined,
      expectedTotal: priceWithAddOns(quote, draft.vehicleId, draft.addOns).total,
    });
    if (res.ok) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      router.push(`/booking/${res.reference}`);
      return;
    }
    const code = res.errors[0]?.code;
    if (code === "QUOTE_EXPIRED" || code === "PRICE_CHANGED") {
      await fetchQuote(draft, errorMessages[code]);
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
    const index = STEPS.findIndex((s) => s.id === state.step);
    if (state.step === "airport") {
      if (state.quote || (await fetchQuote(state.draft))) go("vehicle");
      return;
    }
    if (state.step === "review") {
      await submit();
      return;
    }
    go(STEPS[index + 1].id);
  }

  const index = STEPS.findIndex((s) => s.id === state.step);
  const current = STEPS[index];
  const StepBody = STEP_COMPONENTS[state.step];
  const generalErrors = state.errors.filter((e) => !stepForErrors([e]));
  const runningTotal =
    state.quote && state.draft.vehicleId && NEEDS_QUOTE.includes(state.step)
      ? priceWithAddOns(state.quote, state.draft.vehicleId, state.draft.addOns).total
      : null;

  const primaryLabel =
    state.step === "airport"
      ? "Get my instant quote"
      : state.step === "review"
        ? "Confirm booking"
        : "Continue";
  const busyLabel = state.busy === "quote" ? "Calculating…" : state.busy === "booking" ? "Booking…" : null;
  const HeadingTag = variant === "hero" ? "h2" : "h1";

  return (
    <div
      ref={rootRef}
      className="scroll-mt-20 overflow-clip rounded-3xl bg-white text-ink shadow-card ring-1 ring-black/5"
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
        <div className="px-5 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
            <span>
              Step {index + 1} of {STEPS.length}
            </span>
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(STEPS[index - 1].id)}
                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-surface hover:text-ink"
              >
                <Icon name="arrowLeft" className="size-3.5" />
                Back
              </button>
            )}
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-label="Booking progress"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={index + 1}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <HeadingTag
            ref={headingRef}
            tabIndex={-1}
            className="mt-5 font-display text-2xl font-bold tracking-tight outline-none sm:text-[1.7rem]"
          >
            {current.title}
          </HeadingTag>
        </div>

        {/* Body */}
        <div key={state.step} className="px-5 pt-5 pb-6 animate-step-in sm:px-7">
          {state.notice && (
            <p
              role="status"
              className="mb-4 flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm font-medium text-ink"
            >
              <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-accent-strong" />
              {state.notice}
            </p>
          )}
          {generalErrors.length > 0 && (
            <div role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {generalErrors.map((e) => (
                <p key={e.code}>{e.message}</p>
              ))}
              {generalErrors.some((e) => e.code === "LOCATION_LOOKUP_FAILED" || e.code === "SERVER_ERROR") && (
                <p className="mt-1">
                  You can also book by phone on{" "}
                  <a className="font-semibold underline" href={site.phone.href}>
                    {site.phone.display}
                  </a>
                  .
                </p>
              )}
            </div>
          )}
          <StepBody state={state} set={set} go={go} />
        </div>

        {/* Action bar — sticks to the bottom of the screen on mobile while the card is in view. */}
        <div className="sticky bottom-0 z-20 border-t border-line bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-4">
            {runningTotal !== null && (
              <div className="min-w-0" aria-live="polite">
                <p className="text-xs text-ink-soft">Total</p>
                <p className="font-display text-xl font-bold tabular-nums">{formatGBP(runningTotal)}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={state.busy !== null}
              className={
                "inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl px-6 text-base font-bold transition " +
                "active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 " +
                (state.step === "airport" || state.step === "review"
                  ? "bg-accent text-ink hover:bg-accent-strong"
                  : "bg-ink text-white hover:bg-night-3")
              }
            >
              {busyLabel ?? primaryLabel}
              {!busyLabel && <Icon name={state.step === "review" ? "check" : "arrowRight"} className="size-5" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
