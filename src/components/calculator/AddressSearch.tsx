"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FieldError, inputClass } from "@/components/ui/form";
import { Icon } from "@/components/ui/Icon";
import { serviceArea } from "@/config/service-area";
import { site } from "@/config/site";
import { errorMessages } from "@/lib/domain/errors";
import { isInServiceArea } from "@/lib/domain/geo";
import type { ResolvedLocation } from "@/lib/domain/types";
import { searchLocations } from "./api";

interface Props {
  id: string;
  label: string;
  placeholder?: string;
  value: ResolvedLocation | null;
  error?: string;
  onChange: (value: ResolvedLocation | null) => void;
}

type Status = "idle" | "loading" | "done" | "failed";

/**
 * Accessible combobox (WAI-ARIA 1.2 pattern) for postcodes and London areas.
 * Selecting a result stores the resolved location; the server re-resolves it by id.
 */
export function AddressSearch({ id, label, placeholder, value, error, onChange }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResolvedLocation[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await searchLocations(q, controller.signal);
        if (res.ok) {
          setResults(res.results);
          setStatus("done");
        } else {
          setResults([]);
          setStatus("failed");
        }
        setActive(-1);
      } catch {
        /* aborted by a newer keystroke */
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);

  function choose(loc: ResolvedLocation) {
    onChange(loc);
    setOpen(false);
    setQuery("");
    setResults([]);
    setStatus("idle");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const outside = value && !isInServiceArea(value, serviceArea);
  const shownError = error ?? (outside ? errorMessages.ADDRESS_OUTSIDE_AREA : undefined);

  if (value) {
    return (
      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
        <div
          className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 ${shownError ? "border-danger" : "border-line"}`}
        >
          <Icon name="pin" className="size-5 shrink-0 text-accent-strong" />
          <p className="min-w-0 flex-1 truncate font-semibold">{value.label}</p>
          <button
            type="button"
            id={id}
            onClick={() => {
              onChange(null);
              requestAnimationFrame(() => document.getElementById(`${id}-input`)?.focus());
            }}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-sky hover:bg-surface"
            aria-label={`Change ${label.toLowerCase()}`}
          >
            Change
          </button>
        </div>
        <FieldError id={`${id}-error`} message={shownError} />
        {outside && !error && (
          <p className="mt-1 text-sm text-ink-soft">
            We currently quote online within {serviceArea.label}. Call{" "}
            <a className="font-semibold underline" href={site.phone.href}>
              {site.phone.display}
            </a>{" "}
            to ask about other areas.
          </p>
        )}
      </div>
    );
  }

  const showList = open && query.trim().length >= 2 && status !== "idle";

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-faint" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${id}-error` : `${id}-hint`}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder ?? "Postcode or area, e.g. SW1A 1AA"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value.trim().length < 2) setStatus("idle");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className={`${inputClass} h-13 pl-12`}
        />
        {status === "loading" && (
          <span
            className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-ink"
            aria-hidden="true"
          />
        )}
      </div>
      {!shownError && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-soft">
          Search by postcode or area. You&apos;ll add your house number later.
        </p>
      )}
      <FieldError id={`${id}-error`} message={shownError} />

      {showList && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-white shadow-card animate-fade-in">
          <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="max-h-72 overflow-y-auto py-1">
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${i === active ? "bg-surface" : "hover:bg-surface"}`}
              >
                <Icon name="pin" className="size-4 shrink-0 text-ink-faint" />
                <span className="truncate">{r.label}</span>
              </li>
            ))}
          </ul>
          {status === "done" && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-soft" role="status">
              No matches. Try your full postcode.
            </p>
          )}
          {status === "loading" && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-soft" role="status">
              Searching…
            </p>
          )}
          {status === "failed" && (
            <div className="space-y-2 px-4 py-3 text-sm" role="alert">
              <p className="text-danger">{errorMessages.LOCATION_LOOKUP_FAILED}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAttempt((n) => n + 1)}
                  className="font-semibold text-sky underline"
                >
                  Try again
                </button>
                <a href={site.phone.href} className="font-semibold underline">
                  Call {site.phone.display}
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
