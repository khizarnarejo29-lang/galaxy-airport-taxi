import { describe, expect, it } from "vitest";
import { fieldError } from "@/lib/domain/errors";
import { emptyDraft, reducer, stepForErrors, type CalcState } from "./state";

describe("stepForErrors", () => {
  it.each([
    ["address", "journey"],
    ["extraStops.1", "journey"],
    ["time", "when"],
    ["passengers", "party"],
    ["terminal", "airport"],
    ["vehicleId", "vehicle"],
    ["addressLine1", "details"],
    ["addressPostcode", "details"],
    ["customer.email", "details"],
    ["addOns.childSeats", "details"],
  ])("%s → %s", (field, step) => {
    expect(stepForErrors([fieldError(field, "BAD_REQUEST")])).toBe(step);
  });

  it("picks the earliest step", () => {
    expect(stepForErrors([fieldError("customer.name", "NAME_REQUIRED"), fieldError("date", "DATE_INVALID")])).toBe("when");
  });

  it("ignores errors that belong to no step", () => {
    expect(stepForErrors([fieldError("quote", "QUOTE_INVALID")])).toBeUndefined();
  });
});

describe("reducer", () => {
  const base: CalcState = { step: "vehicle", draft: emptyDraft, errors: [], quote: null, busy: null, notice: null, hydrated: true };
  const quote = { quote: { options: [] }, token: "t" } as unknown as CalcState["quote"];

  it("drops the quote when a priced field changes", () => {
    const next = reducer({ ...base, quote }, { type: "set", patch: { passengers: 3 } });
    expect(next.quote).toBeNull();
  });

  it("keeps the quote for unpriced fields", () => {
    const next = reducer({ ...base, quote }, { type: "set", patch: { notes: "hi" } });
    expect(next.quote).toBe(quote);
  });

  it("clears only the edited field's errors", () => {
    const errors = [fieldError("customer.email", "EMAIL_INVALID"), fieldError("addressLine1", "ADDRESS_LINE_REQUIRED")];
    const next = reducer({ ...base, errors }, { type: "set", patch: { customer: emptyDraft.customer } });
    expect(next.errors.map((e) => e.field)).toEqual(["addressLine1"]);
  });

  it("resets the terminal when the airport changes", () => {
    const next = reducer({ ...base, draft: { ...emptyDraft, airport: "LHR", terminal: "T5" } }, {
      type: "set",
      patch: { airport: "LGW" },
    });
    expect(next.draft.terminal).toBe("");
  });

  it("restores a saved session only once", () => {
    const saved = { step: "review" as const, draft: emptyDraft, quote: null };
    const first = reducer({ ...base, step: "journey", hydrated: false }, { type: "restore", state: saved });
    expect(first.step).toBe("review");
    expect(reducer(first, { type: "restore", state: { ...saved, step: "journey" } }).step).toBe("review");
  });
});
