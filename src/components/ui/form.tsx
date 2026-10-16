"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon";

export const inputClass =
  "block w-full rounded-(--radius-control) border border-line bg-white px-4 text-base text-ink shadow-control " +
  "placeholder:text-ink-faint transition-[border-color,box-shadow] hover:border-ink-faint/60 " +
  "focus:border-sky focus:outline-none focus:ring-4 focus:ring-sky/15 " +
  "aria-invalid:border-danger aria-invalid:focus:ring-danger/15 " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-faint";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger animate-fade-in">
      <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}

/** Label + control + hint + error, wired together for screen readers via ids. */
export function Field({ id, label, hint, error, optional, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-faint">Optional</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-2 text-sm leading-relaxed text-ink-soft">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** aria props for a control inside <Field>. */
export function describedBy(id: string, error?: string, hint?: boolean) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} h-13 ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputClass} py-3 ${props.className ?? ""}`} />;
}

interface CounterProps {
  id: string;
  label: string;
  hint?: string;
  icon: "user" | "suitcase" | "bag" | "sparkle";
  value: number | null;
  min?: number;
  max: number;
  error?: string;
  onChange: (value: number) => void;
}

/** Big-target stepper. A null value shows "–" so "not answered" differs from 0. */
export function Counter({ id, label, hint, icon, value, min = 0, max, error, onChange }: CounterProps) {
  const current = value ?? min - 1;
  const btn =
    "grid size-11 place-items-center rounded-full border border-line bg-white text-ink transition " +
    "hover:border-ink hover:bg-surface active:scale-95 " +
    "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:bg-white";
  return (
    <div>
      <div
        className={`flex items-center gap-3 rounded-xl border bg-white p-3 pl-4 shadow-control ${error ? "border-danger" : "border-line"}`}
      >
        <Icon name={icon} className="size-5 shrink-0 text-ink-soft" />
        <div className="min-w-0 flex-1">
          <p id={`${id}-label`} className="font-semibold text-ink">
            {label}
          </p>
          {hint && <p className="text-sm text-ink-soft">{hint}</p>}
        </div>
        <button
          type="button"
          className={btn}
          aria-label={`Fewer: ${label}`}
          disabled={value === null || value <= min}
          onClick={() => onChange(Math.max(min, current - 1))}
        >
          <Icon name="minus" className="size-4" />
        </button>
        <output
          id={id}
          aria-labelledby={`${id}-label`}
          aria-live="polite"
          tabIndex={-1}
          className="w-8 text-center font-display text-xl font-semibold tabular-nums"
        >
          {value ?? "–"}
        </output>
        <button
          type="button"
          className={btn}
          aria-label={`More: ${label}`}
          disabled={current >= max}
          onClick={() => onChange(value === null ? Math.max(min, 1) : Math.min(max, current + 1))}
        >
          <Icon name="plus" className="size-4" />
        </button>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
}

interface ChoiceCardsProps<T extends string> {
  id: string;
  legend: string;
  hideLegend?: boolean;
  name: string;
  options: ChoiceOption<T>[];
  value: T | null | "";
  error?: string;
  columns?: string;
  onChange: (value: T) => void;
}

/** Radio group styled as tappable cards. Native radios keep keyboard support. */
export function ChoiceCards<T extends string>({
  id,
  legend,
  hideLegend,
  name,
  options,
  value,
  error,
  columns = "grid-cols-2",
  onChange,
}: ChoiceCardsProps<T>) {
  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={hideLegend ? "sr-only" : "mb-2.5 text-sm font-semibold text-ink"}>{legend}</legend>
      <div className={`grid gap-2 ${columns}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className={
              "group relative flex min-h-12 cursor-pointer flex-col justify-center rounded-(--radius-control) border bg-white py-3 pr-8 pl-3.5 " +
              "transition-[border-color,background-color,color,box-shadow] " +
              "has-checked:border-ink has-checked:bg-ink has-checked:text-white has-checked:shadow-card " +
              "has-focus-visible:ring-4 has-focus-visible:ring-sky/30 " +
              (error ? "border-danger" : "border-line hover:border-ink-faint")
            }
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {/* Selected mark: decorative, the radio itself carries the state. */}
            <span
              aria-hidden="true"
              className="absolute top-2.5 right-2.5 grid size-4.5 place-items-center rounded-full border border-line group-has-checked:border-white group-has-checked:bg-white group-has-checked:text-ink"
            >
              <Icon name="check" className="hidden size-3 group-has-checked:block" strokeWidth={2.6} />
            </span>
            <span className="font-semibold leading-tight">{o.label}</span>
            {o.description && <span className="mt-1 text-xs leading-snug opacity-75">{o.description}</span>}
          </label>
        ))}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}
