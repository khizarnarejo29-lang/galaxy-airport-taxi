"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { bookingRules } from "@/config/booking-rules";
import { fleet, getVehicle } from "@/config/fleet";
import { site } from "@/config/site";
import { airports, getAirport } from "@/lib/domain/airports";
import { describeLuggage, luggageCategoryLabels } from "@/lib/domain/luggage";
import { describeEnd } from "@/lib/domain/route";
import { luggageCategories, type AirportCode, type QuoteOption } from "@/lib/domain/types";
import { addDays, formatJourneyDate, londonToday } from "@/lib/utils/dates";
import { formatGBP } from "@/lib/utils/money";
import { ChoiceCards, Counter, describedBy, Field, FieldError, TextArea, TextInput, ToggleCards } from "@/components/ui/form";
import { Icon } from "@/components/ui/Icon";
import { AddressSearch } from "./AddressSearch";
import {
  addressLines,
  chosenLuggage,
  errorFor,
  fieldId,
  isReturn,
  meetAndGreetAvailable,
  needsTerminal,
  outwardAirport,
  returnHasAirport,
  returnPicksUpAtAirport,
  selectedOption,
  toggleLuggage,
  type CalcState,
  type Draft,
  type StepId,
} from "./state";

export interface StepProps {
  state: CalcState;
  set: (patch: Partial<Draft>) => void;
  go: (step: StepId) => void;
}

const err = (s: CalcState, field: string) => errorFor(s.errors, field);

function Checkbox({ checked, onChange, title, children }: { checked: boolean; onChange: (v: boolean) => void; title: string; children?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3.5 rounded-(--radius-control) border border-line bg-white p-4 transition-[border-color,box-shadow] hover:border-ink-faint has-checked:border-ink has-checked:shadow-[inset_0_0_0_1px_var(--color-ink)] has-focus-visible:ring-4 has-focus-visible:ring-sky/30">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink" />
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        {children && <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">{children}</span>}
      </span>
    </label>
  );
}

function SubHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="font-display text-xl font-semibold tracking-tight">
      {children}
    </h3>
  );
}

/** Shown wherever no instant price can be given. Never shows an amount. */
export function PriceOnRequestPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-(--radius-control) border border-line bg-surface p-4 text-sm sm:p-5" role="status">
      <p className="font-display text-base font-semibold text-ink">
        {compact ? "Price on request" : "We can't show an instant price for this journey yet."}
      </p>
      <p className="mt-1 leading-relaxed text-ink-soft">
        Please call us for a fixed price. Phone is currently the most reliable way to get a quote.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={site.phone.href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 font-semibold text-white transition hover:bg-night-3"
        >
          <Icon name="phone" className="size-4" />
          Call {site.phone.display}
        </a>
        <Link
          href="/contact"
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2.5 font-semibold text-ink transition hover:border-ink"
        >
          <Icon name="mail" className="size-4" />
          Other ways to contact us
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────── 1. Journey ───────────────────────── */

const END_KINDS = [
  { value: "address" as const, label: "Address or postcode" },
  { value: "airport" as const, label: "Airport" },
];

/** One end of the outward journey: the address-or-airport choice, then the search or the airport list. */
function EndPicker({ state, set, end }: Pick<StepProps, "state" | "set"> & { end: "pickup" | "dropoff" }) {
  const d = state.draft;
  const name = end === "pickup" ? "Pickup" : "Drop-off";
  const kind = d[`${end}Kind`];
  return (
    <section className="space-y-4" aria-labelledby={`calc-${end}-heading`}>
      <SubHeading id={`calc-${end}-heading`}>{name}</SubHeading>
      <ChoiceCards
        id={fieldId(`${end}Kind`)}
        legend={`${name}: address or airport?`}
        hideLegend
        name={`${end}Kind`}
        value={kind}
        options={END_KINDS}
        onChange={(value) => set({ [`${end}Kind`]: value })}
      />
      {kind === "airport" ? (
        <ChoiceCards
          id={fieldId(end)}
          legend={`${name} airport`}
          name={`${end}Airport`}
          value={d[`${end}Airport`]}
          error={err(state, end)}
          columns="grid-cols-2 sm:grid-cols-3"
          options={airports.map((a) => ({ value: a.code, label: a.shortName, description: a.code }))}
          onChange={(airport) => set({ [`${end}Airport`]: airport })}
        />
      ) : (
        <AddressSearch
          id={fieldId(end)}
          label={`${name} address`}
          value={d[`${end}Address`]}
          error={err(state, end)}
          onChange={(address) => set({ [`${end}Address`]: address })}
        />
      )}
    </section>
  );
}

/** Up to the stop limit on one leg, each a postcode-search result. */
function StopsEditor({
  state,
  set,
  field,
  addLabel,
}: Pick<StepProps, "state" | "set"> & { field: "extraStops" | "returnExtraStops"; addLabel: string }) {
  const list = state.draft[field];
  const errorPrefix = field === "extraStops" ? "extraStops" : "returnJourney.extraStops";
  const label = field === "extraStops" ? "Stop" : "Return stop";
  return (
    <>
      {list.map((stop, i) => (
        <div key={i} className="relative rounded-(--radius-control) border border-dashed border-ink-faint/40 bg-surface/60 p-4">
          <AddressSearch
            id={fieldId(`${errorPrefix}.${i}`)}
            label={`${label} ${i + 1}`}
            value={stop}
            error={err(state, `${errorPrefix}.${i}`)}
            onChange={(loc) => set({ [field]: list.map((s, j) => (j === i ? loc : s)) })}
          />
          <button
            type="button"
            onClick={() => set({ [field]: list.filter((_, j) => j !== i) })}
            className="absolute top-2 right-2 grid size-10 place-items-center rounded-lg text-ink-soft transition hover:bg-white hover:text-ink"
            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>
      ))}
      {list.length < bookingRules.maxExtraStops && (
        <button
          type="button"
          onClick={() => set({ [field]: [...list, null] })}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-sky underline-offset-2 hover:underline"
        >
          <Icon name="plus" className="size-4" />
          {addLabel}
        </button>
      )}
      <FieldError id={`${fieldId(errorPrefix)}-error`} message={err(state, errorPrefix)} />
    </>
  );
}

export function JourneyStep({ state, set }: StepProps) {
  const d = state.draft;
  return (
    <div className="space-y-6">
      <ChoiceCards
        id={fieldId("tripType")}
        legend="One way or return?"
        name="tripType"
        value={d.tripType}
        error={err(state, "tripType")}
        options={[
          { value: "one_way", label: "One way" },
          { value: "return", label: "Return", description: "Book the way back too" },
        ]}
        onChange={(tripType) => set({ tripType })}
      />

      <EndPicker state={state} set={set} end="pickup" />
      <StopsEditor state={state} set={set} field="extraStops" addLabel="Add a stop on the way" />
      <EndPicker state={state} set={set} end="dropoff" />

      {isReturn(d) && (
        <section className="space-y-4" aria-labelledby="calc-return-heading">
          <SubHeading id="calc-return-heading">Your return journey</SubHeading>
          <Checkbox
            checked={d.returnFromDifferentAddress}
            onChange={(returnFromDifferentAddress) => set({ returnFromDifferentAddress })}
            title="Collect me from a different place on the way back"
          >
            Otherwise we&apos;ll collect you from your drop-off and take you back to your pickup.
          </Checkbox>
          {d.returnFromDifferentAddress && (
            <AddressSearch
              id={fieldId("returnJourney.pickup")}
              label="Return pickup address"
              value={d.returnPickupAddress}
              error={err(state, "returnJourney.pickup")}
              onChange={(returnPickupAddress) => set({ returnPickupAddress })}
            />
          )}
          <FieldError
            id={`${fieldId("returnJourney.pickup")}-error`}
            message={d.returnFromDifferentAddress ? undefined : err(state, "returnJourney.pickup")}
          />
          <StopsEditor state={state} set={set} field="returnExtraStops" addLabel="Add a stop on the way back" />
        </section>
      )}
    </div>
  );
}

/* ───────────────────────── 2. When ───────────────────────── */

export function WhenStep({ state, set }: StepProps) {
  const d = state.draft;
  const today = londonToday();
  const pickup = d.pickupKind === "airport";
  const backFromAirport = returnPicksUpAtAirport(d);
  const timeHint = pickup
    ? "The scheduled landing time shown on your flight booking (UK time)."
    : "When you'd like to be collected (UK time).";
  return (
    <div className="space-y-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={fieldId("date")} label={pickup ? "Arrival date" : "Pickup date"} error={err(state, "date")}>
          <TextInput
            type="date"
            className="min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left"
            min={today}
            max={addDays(today, bookingRules.maxDaysAhead)}
            value={d.date}
            onChange={(e) => set({ date: e.target.value })}
            {...describedBy(fieldId("date"), err(state, "date"))}
          />
        </Field>
        <Field
          id={fieldId("time")}
          label={pickup ? "Flight landing time" : "Pickup time"}
          hint={timeHint}
          error={err(state, "time")}
        >
          <TextInput
            type="time"
            className="min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left"
            step={300}
            value={d.time}
            onChange={(e) => set({ time: e.target.value })}
            {...describedBy(fieldId("time"), err(state, "time"), true)}
          />
        </Field>
      </div>

      {isReturn(d) && (
        <section className="space-y-4" aria-labelledby="calc-return-when-heading">
          <SubHeading id="calc-return-when-heading">Return journey</SubHeading>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id={fieldId("returnJourney.date")}
              label={backFromAirport ? "Return arrival date" : "Return pickup date"}
              error={err(state, "returnJourney.date")}
            >
              <TextInput
                type="date"
                className="min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left"
                min={d.date || today}
                max={addDays(today, bookingRules.maxDaysAhead)}
                value={d.returnDate}
                onChange={(e) => set({ returnDate: e.target.value })}
                {...describedBy(fieldId("returnJourney.date"), err(state, "returnJourney.date"))}
              />
            </Field>
            <Field
              id={fieldId("returnJourney.time")}
              label={backFromAirport ? "Return flight landing time" : "Return pickup time"}
              hint={
                backFromAirport
                  ? "The scheduled landing time of your return flight (UK time)."
                  : "When you'd like to be collected for the way back (UK time)."
              }
              error={err(state, "returnJourney.time")}
            >
              <TextInput
                type="time"
                className="min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left"
                step={300}
                value={d.returnTime}
                onChange={(e) => set({ returnTime: e.target.value })}
                {...describedBy(fieldId("returnJourney.time"), err(state, "returnJourney.time"), true)}
              />
            </Field>
          </div>
        </section>
      )}

      <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
        <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
        {/* One string: separate text pieces inside this flex row lost the space before "hours". */}
        <span>{`Online bookings need at least ${bookingRules.minNoticeMinutes / 60} hours' notice.`}</span>
      </p>
    </div>
  );
}

/* ───────────────────────── 3. Party ───────────────────────── */

export function PartyStep({ state, set }: StepProps) {
  const d = state.draft;
  const maxPassengers = Math.max(...fleet.map((v) => v.maxPassengers));
  const chosen = chosenLuggage(d);
  return (
    <div className="space-y-3">
      <Counter
        id={fieldId("passengers")}
        label="Passengers"
        hint="Including children and infants"
        icon="user"
        value={d.passengers}
        min={1}
        max={maxPassengers}
        error={err(state, "passengers")}
        onChange={(passengers) => set({ passengers })}
      />
      <div className="pt-3">
        <ToggleCards
          id={fieldId("luggageCategory")}
          legend="Luggage"
          hint="Choose all that apply."
          checked={chosen}
          error={err(state, "luggageCategory")}
          columns="grid-cols-1 sm:grid-cols-3"
          options={luggageCategories.map((c) => ({ value: c, label: luggageCategoryLabels[c] }))}
          onToggle={(item) => set(toggleLuggage(d, item))}
        />
      </div>
      {chosen.hand_luggage && (
        <Counter
          id={fieldId("luggageCounts.handLuggage")}
          label="Hand luggage"
          hint="How many bags"
          icon="bag"
          value={d.handLuggageCount}
          min={1}
          max={bookingRules.maxLuggageItems}
          onChange={(handLuggageCount) => set({ handLuggageCount })}
        />
      )}
      {chosen.suitcases && (
        <Counter
          id={fieldId("luggageCounts.suitcases")}
          label="Suitcases"
          hint="How many suitcases"
          icon="suitcase"
          value={d.suitcaseCount}
          min={1}
          max={bookingRules.maxLuggageItems}
          onChange={(suitcaseCount) => set({ suitcaseCount })}
        />
      )}
      <div className="pt-3">
        {/* "Yes" is never priced instantly: no size is assumed for a "suitcases" fare. */}
        <ChoiceCards
          id={fieldId("largeItems")}
          legend="Are you bringing any large or unusual items, such as bikes or golf bags?"
          name="largeItems"
          value={d.largeItems === null ? null : d.largeItems ? "yes" : "no"}
          error={err(state, "largeItems")}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
          onChange={(answer) => set({ largeItems: answer === "yes" })}
        />
      </div>
      <p className="flex items-start gap-2 pt-1 text-sm text-ink-soft">
        <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
        Bringing large or unusual items, such as bikes or golf bags? Please call us before booking.
      </p>
    </div>
  );
}

/* ───────────────────────── 4. Airport details ───────────────────────── */

function TerminalPicker({
  state,
  set,
  airportCode,
  field,
  errorField,
  legend,
}: Pick<StepProps, "state" | "set"> & {
  airportCode: AirportCode | null;
  field: "terminal" | "returnTerminal";
  errorField: string;
  legend: string;
}) {
  const airport = airportCode ? getAirport(airportCode) : undefined;
  if (!airport) return null;
  if (!needsTerminal(airport.code)) {
    return field === "terminal" ? (
      <p className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-ink-soft">
        <Icon name="terminal" className="size-4 shrink-0" />
        {airport.name} has a single passenger terminal, so there&apos;s nothing to choose.
      </p>
    ) : null;
  }
  return (
    <ChoiceCards
      id={fieldId(errorField)}
      legend={legend}
      name={field}
      value={state.draft[field]}
      error={err(state, errorField)}
      columns={airport.terminals.length > 2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}
      options={airport.terminals.map((t) => ({ value: t.id, label: t.name }))}
      onChange={(terminal) => set({ [field]: terminal })}
    />
  );
}

function FlightField({
  state,
  set,
  field,
  required,
}: Pick<StepProps, "state" | "set"> & { field: "flightNumber" | "returnFlightNumber"; required: boolean }) {
  const d = state.draft;
  const errorField = field === "flightNumber" ? "flightNumber" : "returnJourney.flightNumber";
  return (
    <Field
      id={fieldId(errorField)}
      label={field === "flightNumber" ? "Flight number" : "Return flight number"}
      optional={!required}
      hint={required ? "Needed so your driver knows which arrival to meet." : "Useful if your departure changes, but not required."}
      error={err(state, errorField)}
    >
      <TextInput
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="e.g. BA2490"
        maxLength={10}
        value={d[field]}
        onChange={(e) => set({ [field]: e.target.value.toUpperCase() })}
        className="uppercase"
        {...describedBy(fieldId(errorField), err(state, errorField), true)}
      />
    </Field>
  );
}

export function AirportStep(props: StepProps) {
  const d = props.state.draft;
  const code = outwardAirport(d);
  const airport = code ? getAirport(code) : undefined;
  const fromAirport = d.pickupKind === "airport";
  const outwardEnd = fromAirport ? "pickup" : "dropoff";
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        {isReturn(d) && <SubHeading>Outward journey</SubHeading>}
        <TerminalPicker
          {...props}
          airportCode={code}
          field="terminal"
          errorField={`${outwardEnd}.terminal`}
          legend={fromAirport ? "Terminal you'll arrive at" : "Terminal you're flying from"}
        />
        <FlightField {...props} field="flightNumber" required={fromAirport} />
      </div>
      {isReturn(d) && returnHasAirport(d) && (
        <section className="space-y-6" aria-labelledby="calc-return-airport-heading">
          <SubHeading id="calc-return-airport-heading">Return journey</SubHeading>
          {returnPicksUpAtAirport(d) ? (
            <TerminalPicker
              {...props}
              airportCode={code}
              field="returnTerminal"
              errorField="returnJourney.pickup.terminal"
              legend="Terminal you'll arrive at"
            />
          ) : (
            // The way back ends at the outward pickup, terminal included.
            <p className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-ink-soft">
              <Icon name="terminal" className="size-4 shrink-0" />
              {`Your return journey ends at ${[airport?.name, airport?.terminals.find((t) => t.id === d.terminal)?.name].filter(Boolean).join(", ")}, where we collected you.`}
            </p>
          )}
          <FlightField {...props} field="returnFlightNumber" required={returnPicksUpAtAirport(d)} />
        </section>
      )}
    </div>
  );
}

/* ───────────────────────── 5. Extras ───────────────────────── */

export function ExtrasStep({ state, set }: StepProps) {
  const d = state.draft;
  return (
    <div className="space-y-3">
      {meetAndGreetAvailable(d) && (
        <Checkbox
          checked={d.addOns.meetAndGreet}
          onChange={(meetAndGreet) => set({ addOns: { ...d.addOns, meetAndGreet } })}
          title="Meet & Greet"
        >
          Your driver meets you inside the arrivals hall with a name board.
        </Checkbox>
      )}
      <Counter
        id={fieldId("addOns.childSeats")}
        label="Child seats"
        hint="Free. Tell us how many you need"
        icon="sparkle"
        value={d.addOns.childSeats}
        max={bookingRules.maxChildSeats}
        error={err(state, "addOns.childSeats")}
        onChange={(childSeats) => set({ addOns: { ...d.addOns, childSeats } })}
      />
      <p className="flex items-start gap-2 pt-2 text-sm text-ink-soft">
        <Icon name="check" className="mt-0.5 size-4 shrink-0" />
        The prices on the next step include the extras you choose here.
      </p>
    </div>
  );
}

/* ───────────────────────── 6. Vehicle ───────────────────────── */

export function VehicleStep({ state, set }: StepProps) {
  const q = state.quote;
  if (!q) return <QuoteLoading />;
  const j = q.quote.journey;
  const anyPriced = q.quote.options.some((o) => o.available);
  const expires = new Date(q.quote.expiresAt).toLocaleTimeString("en-GB", {
    hourCycle: "h23",
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
  const error = err(state, "vehicleId");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-(--radius-control) border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="route" className="size-4" />
          About {Math.round(j.distanceMiles)} miles{j.tripType === "return" ? " each way" : ""}
        </span>
        {anyPriced && <span>Price held until {expires}</span>}
      </div>

      {!anyPriced && <PriceOnRequestPanel />}

      <fieldset id={fieldId("vehicleId")} tabIndex={-1} aria-describedby={error ? `${fieldId("vehicleId")}-error` : undefined}>
        <legend className="sr-only">Vehicle</legend>
        <div className="space-y-2.5">
          {q.quote.options.map((o) => {
            const v = getVehicle(o.vehicleId)!;
            const priced = o.available && o.pricing.status !== "price_on_request";
            return (
              <label
                key={o.vehicleId}
                className={
                  "flex items-center gap-4 rounded-(--radius-control) border bg-white p-4 transition-[border-color,box-shadow] sm:p-5 " +
                  (priced
                    ? "cursor-pointer has-checked:border-ink has-checked:shadow-[inset_0_0_0_1px_var(--color-ink)] hover:border-ink-faint has-focus-visible:ring-4 has-focus-visible:ring-sky/30 "
                    : "cursor-not-allowed bg-surface/50 ") +
                  (error ? "border-danger" : "border-line")
                }
              >
                <input
                  type="radio"
                  name="vehicle"
                  value={o.vehicleId}
                  disabled={!priced}
                  checked={state.draft.vehicleId === o.vehicleId}
                  onChange={() => set({ vehicleId: o.vehicleId })}
                  className="peer sr-only"
                />
                <span
                  className={
                    "grid size-5 shrink-0 place-items-center rounded-full border-2 border-line peer-checked:border-ink peer-checked:bg-ink " +
                    (priced ? "" : "opacity-40")
                  }
                  aria-hidden="true"
                >
                  <span className="size-1.5 rounded-full bg-white" />
                </span>
                <span className={"min-w-0 flex-1 " + (priced ? "" : "opacity-70")}>
                  <span className="block font-display text-lg font-semibold leading-tight">{v.name}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-sm text-ink-soft">
                    <Icon name="user" className="size-3.5" />
                    Up to {v.maxPassengers} passengers
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">
                    {priced ? v.summary : o.unavailableReason && o.unavailableReason !== "Price on request" ? (
                      <span className="font-medium text-danger">{o.unavailableReason}</span>
                    ) : (
                      "We'll confirm a price for this vehicle."
                    )}
                  </span>
                </span>
                <span className="text-right">
                  {priced ? (
                    <>
                      <span className="block font-display text-2xl font-semibold tabular-nums">{formatGBP(o.total)}</span>
                      <span className="text-xs text-ink-soft">{j.tripType === "return" ? "return total" : "total"}</span>
                      {o.pricing.status === "tariff" && o.pricing.events.length > 0 && (
                        <span className="mt-0.5 block text-xs font-semibold text-accent-strong">Includes {o.pricing.events.join(" and ")}</span>
                      )}
                    </>
                  ) : (
                    <span className="block max-w-24 text-sm font-semibold leading-tight text-ink-soft">Price on request</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <FieldError id={`${fieldId("vehicleId")}-error`} message={error} />
      {anyPriced && (
        <>
          <p className="text-xs text-ink-soft">
            Each price is the fixed total for this booking{j.tripType === "return" ? ", covering both journeys," : ""} including
            the extras you chose.
          </p>
          {q.quote.options.some((o) => !o.available) && <PriceOnRequestPanel compact />}
        </>
      )}
    </div>
  );
}

function QuoteLoading() {
  return (
    <div className="space-y-2.5" role="status" aria-label="Calculating your prices">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 rounded-(--radius-control) border border-line p-5" aria-hidden="true">
          <span className="size-5 shrink-0 rounded-full bg-line" />
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-1/3 rounded bg-line" />
            <span className="block h-3 w-1/2 rounded bg-surface" />
          </span>
          <span className="h-6 w-16 rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── 7. Details ───────────────────────── */

const ADDRESS_HEADINGS = {
  pickupLine1: "Pickup address",
  dropoffLine1: "Drop-off address",
  returnPickupLine1: "Return pickup address",
} as const;

export function DetailsStep({ state, set }: StepProps) {
  const d = state.draft;
  const c = d.customer;
  const setCustomer = (patch: Partial<Draft["customer"]>) => set({ customer: { ...c, ...patch } });

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="calc-contact-heading">
        <SubHeading id="calc-contact-heading">Lead passenger</SubHeading>
        <Field id={fieldId("customer.name")} label="Full name" error={err(state, "customer.name")}>
          <TextInput
            autoComplete="name"
            value={c.name}
            onChange={(e) => setCustomer({ name: e.target.value })}
            {...describedBy(fieldId("customer.name"), err(state, "customer.name"))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={fieldId("customer.email")} label="Email" error={err(state, "customer.email")}>
            <TextInput
              type="email"
              inputMode="email"
              autoComplete="email"
              value={c.email}
              onChange={(e) => setCustomer({ email: e.target.value })}
              {...describedBy(fieldId("customer.email"), err(state, "customer.email"))}
            />
          </Field>
          <Field
            id={fieldId("customer.phone")}
            label="Mobile number"
            hint="So your driver can reach you on the day."
            error={err(state, "customer.phone")}
          >
            <TextInput
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={c.phone}
              onChange={(e) => setCustomer({ phone: e.target.value })}
              {...describedBy(fieldId("customer.phone"), err(state, "customer.phone"), true)}
            />
          </Field>
        </div>
      </section>

      {addressLines(d).map(({ field, location }) => (
        <section key={field} className="space-y-4 border-t border-line pt-6" aria-labelledby={`${fieldId(field)}-heading`}>
          <SubHeading id={`${fieldId(field)}-heading`}>{ADDRESS_HEADINGS[field]}</SubHeading>
          <Field
            id={fieldId(field)}
            label="House number and street"
            hint={location ? `In ${location.label}` : undefined}
            error={err(state, field)}
          >
            <TextInput
              autoComplete={field === "pickupLine1" ? "address-line1" : "off"}
              value={d[field]}
              onChange={(e) => set({ [field]: e.target.value })}
              {...describedBy(fieldId(field), err(state, field), true)}
            />
          </Field>
        </section>
      ))}

      {addressLines(d).length > 0 && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          Instant prices apply to one exact address. If yours is different, we&apos;ll ask you to contact us for a price
          instead.
        </p>
      )}

      <section className="space-y-4">
        <Field
          id={fieldId("specialRequirements")}
          label="Special requirements"
          optional
          hint="For example wheelchair access, a folded pushchair or extra assistance."
          error={err(state, "specialRequirements")}
        >
          <TextArea
            maxLength={500}
            value={d.specialRequirements}
            onChange={(e) => set({ specialRequirements: e.target.value })}
            {...describedBy(fieldId("specialRequirements"), err(state, "specialRequirements"), true)}
          />
        </Field>
        <Field id={fieldId("notes")} label="Notes for the driver" optional error={err(state, "notes")}>
          <TextArea
            maxLength={1000}
            value={d.notes}
            onChange={(e) => set({ notes: e.target.value })}
            {...describedBy(fieldId("notes"), err(state, "notes"))}
          />
        </Field>
      </section>
    </div>
  );
}

/* ───────────────────────── 8. Review ───────────────────────── */

/** The review's sections: what the customer checks before booking (also sent in a WhatsApp booking). */
export function reviewSections(d: CalcState["draft"], q: NonNullable<CalcState["quote"]>, option: QuoteOption) {
  const j = q.quote.journey;
  const r = j.returnJourney;
  // House details typed after the quote are shown with the quoted places.
  const pickup = describeEnd(j.pickup, d.pickupLine1.trim() || undefined);
  const dropoff = describeEnd(j.dropoff, d.dropoffLine1.trim() || undefined);
  const returnPickup = r
    ? describeEnd(r.pickup, (d.returnFromDifferentAddress ? d.returnPickupLine1 : d.dropoffLine1).trim() || undefined)
    : "";
  const row = (k: string, v: string): [string, string] => [k, v];

  const sections: { title: string; step: StepId; rows: [string, string][] }[] = [
    {
      title: r ? "Outward journey" : "Journey",
      step: "journey",
      rows: [
        row("From", pickup),
        ...j.extraStops.map((s, i) => row(`Stop ${i + 1}`, s.label)),
        row("To", dropoff),
        row("Date", formatJourneyDate(j.date)),
        row(j.pickup.kind === "airport" ? "Landing time" : "Pickup time", j.time),
        ...(j.flightNumber ? [row("Flight", j.flightNumber)] : []),
      ],
    },
    ...(r
      ? [
          {
            title: "Return journey",
            step: "journey" as StepId,
            rows: [
              row("From", returnPickup),
              ...r.extraStops.map((s, i) => row(`Stop ${i + 1}`, s.label)),
              row("To", pickup),
              row("Date", formatJourneyDate(r.date)),
              row(r.pickup.kind === "airport" ? "Landing time" : "Pickup time", r.time),
              ...(r.flightNumber ? [row("Flight", r.flightNumber)] : []),
            ],
          },
        ]
      : []),
    {
      title: "Travelling",
      step: "party",
      rows: [
        row("Passengers", String(j.passengers)),
        row("Luggage", describeLuggage(j.luggage, j.luggageCategory, j.handLuggageToo, j.luggageCounts)),
        row("Vehicle", getVehicle(option.vehicleId)!.name),
      ],
    },
    {
      title: "Extras",
      step: "extras",
      rows: [
        row("Meet & Greet", j.extras.meetAndGreet ? "Yes" : "No"),
        row("Child seats", String(j.extras.childSeats)),
      ],
    },
    {
      title: "Lead passenger",
      step: "details",
      rows: [
        row("Name", d.customer.name),
        row("Email", d.customer.email),
        row("Mobile", d.customer.phone),
        ...(d.specialRequirements ? [row("Requirements", d.specialRequirements)] : []),
        ...(d.notes ? [row("Notes", d.notes)] : []),
      ],
    },
  ];
  return sections;
}

export function ReviewStep({ state, go }: StepProps) {
  const d = state.draft;
  const q = state.quote;
  const option = selectedOption(d, q);
  if (!q || !option) return <QuoteLoading />;
  const sections = reviewSections(d, q, option);

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.title} className="rounded-(--radius-control) border border-line bg-white p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2">
            <h3 className="text-xs font-bold tracking-wider text-accent-strong uppercase">{s.title}</h3>
            <button
              type="button"
              onClick={() => go(s.step)}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-sky transition hover:bg-surface"
            >
              <Icon name="edit" className="size-3.5" />
              Edit<span className="sr-only"> {s.title.toLowerCase()}</span>
            </button>
          </div>
          <dl className="space-y-2.5 text-sm sm:space-y-2">
            {s.rows.map(([k, v]) => (
              <div key={k} className="sm:flex sm:gap-4">
                <dt className="text-xs text-ink-soft sm:w-32 sm:shrink-0 sm:text-sm">{k}</dt>
                <dd className="min-w-0 flex-1 font-medium break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="rounded-(--radius-control) bg-night p-5 text-white sm:p-6" aria-label="Price breakdown">
        <dl className="space-y-1.5 text-sm">
          {option.lines.map((l) => (
            <div key={l.code} className="flex justify-between gap-4 text-white/75">
              <dt>{l.label}</dt>
              <dd className="tabular-nums">{formatGBP(l.amount)}</dd>
            </div>
          ))}
          <div className="mt-3 flex items-baseline justify-between border-t border-white/15 pt-3">
            <dt className="font-semibold">Total fare</dt>
            <dd className="font-display text-3xl font-semibold tabular-nums">{formatGBP(option.total)}</dd>
          </div>
        </dl>
      </section>
      {q.onlineBooking === false && (
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Icon name="chat" className="mt-0.5 size-4 shrink-0 text-success" />
          Tap &ldquo;Book on WhatsApp&rdquo; and your booking opens in WhatsApp, ready to send. We&apos;ll reply there to
          confirm it. You can also call us on {site.phone.display}.
        </p>
      )}
      {q.onlineBooking !== false && q.cardPayments && (
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Icon name="check" className="mt-0.5 size-4 shrink-0 text-success" />
          Next you pay by card on Stripe&apos;s secure payment page. Your card details never reach this website.
        </p>
      )}
    </div>
  );
}
