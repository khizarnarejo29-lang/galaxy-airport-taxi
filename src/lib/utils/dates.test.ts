import { describe, expect, it } from "vitest";
import { isValidDateString, londonToday, londonToUtc } from "./dates";

describe("londonToUtc", () => {
  it("handles GMT (winter)", () => {
    expect(londonToUtc("2026-01-15", "09:30").toISOString()).toBe("2026-01-15T09:30:00.000Z");
  });

  it("handles BST (summer)", () => {
    expect(londonToUtc("2026-07-15", "09:30").toISOString()).toBe("2026-07-15T08:30:00.000Z");
  });

  it("handles the day the clocks go back", () => {
    expect(londonToUtc("2026-10-25", "12:00").toISOString()).toBe("2026-10-25T12:00:00.000Z");
  });
});

describe("londonToday", () => {
  it("uses London's date, not UTC's", () => {
    // 23:30 UTC on 5 July is 00:30 on 6 July in London.
    expect(londonToday(new Date("2026-07-05T23:30:00Z"))).toBe("2026-07-06");
  });
});

describe("isValidDateString", () => {
  it.each([
    ["2026-02-28", true],
    ["2028-02-29", true],
    ["2026-02-29", false],
    ["2026-13-01", false],
    ["05/10/2026", false],
  ])("%s → %s", (value, expected) => {
    expect(isValidDateString(value)).toBe(expected);
  });
});
