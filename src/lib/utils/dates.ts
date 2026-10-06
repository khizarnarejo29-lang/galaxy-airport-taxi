/**
 * Journeys are always entered and displayed in London local time.
 * These helpers convert between London wall-clock time and UTC without a
 * date library, and handle the BST/GMT changeover.
 */
const TZ = "Europe/London";

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function londonParts(at: Date) {
  const parts = partsFormatter.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Minutes London is ahead of UTC at the given instant (0 in GMT, 60 in BST). */
function londonOffsetMinutes(at: Date): number {
  const p = londonParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const floored = Math.floor(at.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - floored) / 60_000);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isValidTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

/** Convert a London wall-clock date + time into a UTC instant. */
export function londonToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  const firstGuess = wallAsUtc - londonOffsetMinutes(new Date(wallAsUtc)) * 60_000;
  const corrected = wallAsUtc - londonOffsetMinutes(new Date(firstGuess)) * 60_000;
  return new Date(corrected);
}

/** Today's date in London as YYYY-MM-DD. */
export function londonToday(now: Date = new Date()): string {
  const p = londonParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

const displayDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "Mon 12 Oct 2026" for a YYYY-MM-DD London date. */
export function formatJourneyDate(date: string): string {
  return displayDate.format(londonToUtc(date, "12:00"));
}
