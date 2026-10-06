"use client";

import { bookingRules } from "@/config/booking-rules";
import { fleet, getVehicle } from "@/config/fleet";
import { pricing } from "@/config/pricing";
import { airports, getAirport } from "@/lib/domain/airports";
import { addDays, formatJourneyDate, londonToday } from "@/lib/utils/dates";
import { formatGBP } from "@/lib/utils/money";
import { ChoiceCards, Counter, describedBy, Field, FieldError, TextArea, TextInput } from "@/components/ui/form";
import { Icon } from "@/components/ui/Icon";
import { AddressSearch } from "./AddressSearch";
import { priceWithAddOns } from "./pricing";
import { errorFor, fieldId, needsTerminal, type CalcState, type Draft, type StepId } from "./state";

export interface StepProps {
  state: CalcState;
  set: (patch: Partial<Draft>) => void;
  go: (step: StepId) => void;
}

const err = (s: CalcState, field: string) => errorFor(s.errors, field);

/* ───────────────────────── 1. Journey ───────────────────────── */

export function JourneyStep({ state, set }: StepProps) {
  const d = state.draft;
  const toAirport = d.direction === "to_airport";

  const airportPicker = (
    <ChoiceCards
      id={fieldId("airport")}
      legend={toAirport ? "Which airport are you flying from?" : "Which airport are you arriving at?"}
      name="airport"
      value={d.airport}
      error={err(state, "airport")}
      columns="grid-cols-2 sm:grid-cols-3"
      options={airports.map((a) => ({ value: a.code, label: a.shortName, description: a.code }))}
      onChange={(airport) => set({ airport })}
    />
  );

  const addressSearch = (
    <AddressSearch
      id={fieldId("address")}
      label={toAirport ? "Pickup address in London" : "Drop-off address in London"}
      value={d.address}
      error={err(state, "address")}
      onChange={(address) => set({ address, addressPostcode: "" })}
    />
  );

  return (
    <div className="space-y-6">
      <ChoiceCards
        id={fieldId("direction")}
        legend="Where are you travelling?"
        hideLegend
        name="direction"
        value={d.direction}
        error={err(state, "direction")}
        options={[
          { value: "to_airport", label: "To the airport", description: "London → airport" },
          { value: "from_airport", label: "From the airport", description: "Airport → London" },
        ]}
        onChange={(direction) => set({ direction })}
      />

      {toAirport ? addressSearch : airportPicker}

      {d.extraStops.map((stop, i) => (
        <div key={i} className="relative rounded-2xl border border-dashed border-line p-4">
          <AddressSearch
            id={fieldId(`extraStops.${i}`)}
            label={`Extra stop ${i + 1}`}
            value={stop}
            error={err(state, `extraStops.${i}`)}
            onChange={(loc) => set({ extraStops: d.extraStops.map((s, j) => (j === i ? loc : s)) })}
          />
          <button
            type="button"
            onClick={() => set({ extraStops: d.extraStops.filter((_, j) => j !== i) })}
            className="absolute top-3 right-3 rounded-lg p-1.5 text-ink-soft hover:bg-surface"
            aria-label={`Remove extra stop ${i + 1}`}
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>
      ))}
      {d.extraStops.length < bookingRules.maxExtraStops && (
        <button
          type="button"
          onClick={() => set({ extraStops: [...d.extraStops, null] })}
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-sky hover:underline"
        >
          <Icon name="plus" className="size-4" />
          Add a stop on the way <span className="font-normal text-ink-soft">(+{formatGBP(pricing.extras.extraStop)})</span>
        </button>
      )}
      <FieldError id={`${fieldId("extraStops")}-error`} message={err(state, "extraStops")} />

      {toAirport ? airportPicker : addressSearch}
    </div>
  );
}

/* ───────────────────────── 2. When ───────────────────────── */

export function WhenStep({ state, set }: StepProps) {
  const d = state.draft;
  const today = londonToday();
  const pickup = d.direction === "from_airport";
  const timeHint = pickup
    ? "The scheduled landing time shown on your flight booking (UK time)."
    : "When you'd like to be collected (UK time).";
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id={fieldId("date")} label={pickup ? "Arrival date" : "Pickup date"} error={err(state, "date")}>
        <TextInput
          type="date"
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
          step={300}
          value={d.time}
          onChange={(e) => set({ time: e.target.value })}
          {...describedBy(fieldId("time"), err(state, "time"), true)}
        />
      </Field>
      <p className="flex items-start gap-2 text-sm text-ink-soft sm:col-span-2">
        <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
        Online bookings need at least {bookingRules.minNoticeMinutes / 60} hours&apos; notice.
      </p>
    </div>
  );
}

/* ───────────────────────── 3. Party ───────────────────────── */

export function PartyStep({ state, set }: StepProps) {
  const d = state.draft;
  const maxPassengers = Math.max(...fleet.map((v) => v.maxPassengers));
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
      <Counter
        id={fieldId("luggage.large")}
        label="Large cases"
        hint="Checked-in suitcases"
        icon="suitcase"
        value={d.luggage.large}
        max={10}
        onChange={(large) => set({ luggage: { ...d.luggage, large } })}
      />
      <Counter
        id={fieldId("luggage.small")}
        label="Small bags"
        hint="Cabin bags and rucksacks"
        icon="bag"
        value={d.luggage.small}
        max={10}
        onChange={(small) => set({ luggage: { ...d.luggage, small } })}
      />
      <FieldError id={`${fieldId("luggage")}-error`} message={err(state, "luggage")} />
    </div>
  );
}

/* ───────────────────────── 4. Airport details ───────────────────────── */

export function AirportStep({ state, set }: StepProps) {
  const d = state.draft;
  const airport = d.airport ? getAirport(d.airport) : undefined;
  const pickup = d.direction === "from_airport";
  return (
    <div className="space-y-6">
      {airport && needsTerminal(d) ? (
        <ChoiceCards
          id={fieldId("terminal")}
          legend={`${airport.shortName} terminal`}
          name="terminal"
          value={d.terminal}
          error={err(state, "terminal")}
          columns={airport.terminals.length > 2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}
          options={airport.terminals.map((t) => ({ value: t.id, label: t.name }))}
          onChange={(terminal) => set({ terminal })}
        />
      ) : (
        airport && (
          <p className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-ink-soft">
            <Icon name="terminal" className="size-4 shrink-0" />
            {airport.name} has a single passenger terminal, so there&apos;s nothing to choose.
          </p>
        )
      )}
      <Field
        id={fieldId("flightNumber")}
        label="Flight number"
        optional={!pickup}
        hint={
          pickup
            ? "Needed so your driver knows which arrival to meet."
            : "Useful if your departure changes, but not required."
        }
        error={err(state, "flightNumber")}
      >
        <TextInput
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. BA2490"
          maxLength={10}
          value={d.flightNumber}
          onChange={(e) => set({ flightNumber: e.target.value.toUpperCase() })}
          className="uppercase"
          {...describedBy(fieldId("flightNumber"), err(state, "flightNumber"), true)}
        />
      </Field>
    </div>
  );
}

/* ───────────────────────── 5. Vehicle ───────────────────────── */

export function VehicleStep({ state, set }: StepProps) {
  const q = state.quote;
  if (!q) return <QuoteLoading />;
  const j = q.quote.journey;
  const expires = new Date(q.quote.expiresAt).toLocaleTimeString("en-GB", {
    hourCycle: "h23",
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
  const error = err(state, "vehicleId");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface px-4 py-3 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="route" className="size-4" />
          About {Math.round(j.distanceMiles)} miles
        </span>
        <span>Price held until {expires}</span>
        {pricing.isPlaceholder && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-strong">
            Sample prices – not yet live
          </span>
        )}
      </div>

      <fieldset id={fieldId("vehicleId")} tabIndex={-1} aria-describedby={error ? `${fieldId("vehicleId")}-error` : undefined}>
        <legend className="sr-only">Vehicle</legend>
        <div className="space-y-2.5">
          {q.quote.options.map((o) => {
            const v = getVehicle(o.vehicleId)!;
            return (
              <label
                key={o.vehicleId}
                className={
                  "flex items-center gap-4 rounded-2xl border bg-white p-4 transition " +
                  (o.available
                    ? "cursor-pointer has-checked:border-ink has-checked:shadow-[inset_0_0_0_1px_var(--color-ink)] hover:border-ink-faint has-focus-visible:ring-4 has-focus-visible:ring-sky/30 "
                    : "cursor-not-allowed opacity-55 ") +
                  (error ? "border-danger" : "border-line")
                }
              >
                <input
                  type="radio"
                  name="vehicle"
                  value={o.vehicleId}
                  disabled={!o.available}
                  checked={state.draft.vehicleId === o.vehicleId}
                  onChange={() => set({ vehicleId: o.vehicleId })}
                  className="peer sr-only"
                />
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-line peer-checked:border-ink peer-checked:bg-ink"
                  aria-hidden="true"
                >
                  <span className="size-1.5 rounded-full bg-white" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold leading-tight">{v.name}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="user" className="size-3.5" />
                      {v.maxPassengers}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="suitcase" className="size-3.5" />
                      {v.maxLargeCases}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="bag" className="size-3.5" />
                      {v.maxSmallCases}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-ink-soft">
                    {o.available ? v.summary : <span className="font-medium text-danger">{o.unavailableReason}</span>}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-display text-2xl font-bold tabular-nums">{formatGBP(o.total)}</span>
                  <span className="text-xs text-ink-soft">total</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <FieldError id={`${fieldId("vehicleId")}-error`} message={error} />
      <p className="text-xs text-ink-soft">
        Prices include any airport drop-off or parking charge for {getAirport(j.airport)?.shortName}. Optional extras are
        added in the next step.
      </p>
    </div>
  );
}

function QuoteLoading() {
  return (
    <div className="space-y-2.5" role="status" aria-label="Calculating your prices">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  );
}

/* ───────────────────────── 6. Details ───────────────────────── */

export function DetailsStep({ state, set }: StepProps) {
  const d = state.draft;
  const pickup = d.direction === "from_airport";
  const c = d.customer;
  const setCustomer = (patch: Partial<Draft["customer"]>) => set({ customer: { ...c, ...patch } });

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="calc-contact-heading">
        <h3 id="calc-contact-heading" className="font-display text-lg font-bold">
          Lead passenger
        </h3>
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

      <section className="space-y-4" aria-labelledby="calc-address-heading">
        <h3 id="calc-address-heading" className="font-display text-lg font-bold">
          {pickup ? "Drop-off address" : "Pickup address"}
        </h3>
        <Field
          id={fieldId("addressLine1")}
          label="House number and street"
          hint={d.address ? `In ${d.address.label}` : undefined}
          error={err(state, "addressLine1")}
        >
          <TextInput
            autoComplete="address-line1"
            value={d.addressLine1}
            onChange={(e) => set({ addressLine1: e.target.value })}
            {...describedBy(fieldId("addressLine1"), err(state, "addressLine1"), true)}
          />
        </Field>
        {d.address?.kind === "place" && (
          <Field id={fieldId("addressPostcode")} label="Postcode" error={err(state, "addressPostcode")}>
            <TextInput
              autoComplete="postal-code"
              autoCapitalize="characters"
              value={d.addressPostcode}
              onChange={(e) => set({ addressPostcode: e.target.value.toUpperCase() })}
              className="uppercase"
              {...describedBy(fieldId("addressPostcode"), err(state, "addressPostcode"))}
            />
          </Field>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="calc-extras-heading">
        <h3 id="calc-extras-heading" className="font-display text-lg font-bold">
          Extras
        </h3>
        {pickup && (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4 has-checked:border-ink has-focus-visible:ring-4 has-focus-visible:ring-sky/30">
            <input
              type="checkbox"
              checked={d.addOns.meetAndGreet}
              onChange={(e) => set({ addOns: { ...d.addOns, meetAndGreet: e.target.checked } })}
              className="mt-1 size-5 accent-ink"
            />
            <span className="flex-1">
              <span className="block font-semibold">Meet &amp; Greet</span>
              <span className="text-sm text-ink-soft">
                Your driver meets you inside the arrivals hall with a name board.
              </span>
            </span>
            <span className="font-semibold tabular-nums">+{formatGBP(pricing.extras.meetAndGreet)}</span>
          </label>
        )}
        <Counter
          id={fieldId("addOns.childSeats")}
          label="Child seats"
          hint={`${formatGBP(pricing.extras.childSeat)} each`}
          icon="sparkle"
          value={d.addOns.childSeats}
          max={bookingRules.maxChildSeats}
          error={err(state, "addOns.childSeats")}
          onChange={(childSeats) => set({ addOns: { ...d.addOns, childSeats } })}
        />
      </section>

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

/* ───────────────────────── 7. Review ───────────────────────── */

export function ReviewStep({ state, go }: StepProps) {
  const d = state.draft;
  const q = state.quote;
  if (!q || !d.vehicleId) return <QuoteLoading />;
  const j = q.quote.journey;
  const airport = getAirport(j.airport)!;
  const terminal = airport.terminals.find((t) => t.id === j.terminal)?.name;
  const airportLabel = terminal ? `${airport.name}, ${terminal}` : airport.name;
  const address = [d.addressLine1, d.address?.kind === "place" ? d.addressPostcode : null, j.address.label]
    .filter(Boolean)
    .join(", ");
  const toAirport = j.direction === "to_airport";
  const { lines, total } = priceWithAddOns(q, d.vehicleId, d.addOns);

  const sections: { title: string; step: StepId; rows: [string, string][] }[] = [
    {
      title: "Journey",
      step: "journey",
      rows: [
        ["From", toAirport ? address : airportLabel],
        ...j.extraStops.map((s, i): [string, string] => [`Stop ${i + 1}`, s.label]),
        ["To", toAirport ? airportLabel : address],
      ],
    },
    {
      title: "When",
      step: "when",
      rows: [
        ["Date", formatJourneyDate(j.date)],
        [toAirport ? "Pickup time" : "Landing time", j.time],
        ...(j.flightNumber ? [["Flight", j.flightNumber] as [string, string]] : []),
      ],
    },
    {
      title: "Travelling",
      step: "party",
      rows: [
        ["Passengers", String(j.passengers)],
        ["Luggage", `${j.luggage.large} large, ${j.luggage.small} small`],
        ["Vehicle", getVehicle(d.vehicleId)!.name],
      ],
    },
    {
      title: "Lead passenger",
      step: "details",
      rows: [
        ["Name", d.customer.name],
        ["Email", d.customer.email],
        ["Mobile", d.customer.phone],
        ...(d.specialRequirements ? [["Requirements", d.specialRequirements] as [string, string]] : []),
        ...(d.notes ? [["Notes", d.notes] as [string, string]] : []),
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.title} className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-wide text-ink-soft uppercase">{s.title}</h3>
            <button
              type="button"
              onClick={() => go(s.step)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-sky hover:bg-surface"
            >
              <Icon name="edit" className="size-3.5" />
              Edit<span className="sr-only"> {s.title.toLowerCase()}</span>
            </button>
          </div>
          <dl className="space-y-1.5 text-sm">
            {s.rows.map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <dt className="w-28 shrink-0 text-ink-soft">{k}</dt>
                <dd className="min-w-0 flex-1 font-medium break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="rounded-2xl bg-night p-5 text-white" aria-label="Price breakdown">
        <dl className="space-y-1.5 text-sm">
          {lines.map((l) => (
            <div key={l.code} className="flex justify-between gap-4 text-white/75">
              <dt>{l.label}</dt>
              <dd className="tabular-nums">{formatGBP(l.amount)}</dd>
            </div>
          ))}
          <div className="mt-3 flex items-baseline justify-between border-t border-white/15 pt-3">
            <dt className="font-semibold">Total fare</dt>
            <dd className="font-display text-3xl font-bold tabular-nums text-accent">{formatGBP(total)}</dd>
          </div>
        </dl>
        {pricing.isPlaceholder && (
          <p className="mt-3 text-xs text-white/60">Sample pricing for testing — not a live fare.</p>
        )}
      </section>
    </div>
  );
}
