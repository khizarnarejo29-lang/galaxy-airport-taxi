/**
 * Short-lived viewing pass for the booking confirmation page. Only the browser
 * that made the booking gets one, so a shared or guessed link shows no personal
 * details. It travels in an HttpOnly cookie limited to that booking's page —
 * never in a URL, page script or log.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { signingSecret } from "@/lib/quote/token";

export const VIEW_PASS_MINUTES = 60;
export const VIEW_PASS_COOKIE = "gat_booking_view";

// Kept apart from quote signatures, so a quote token can never act as a pass.
const PURPOSE = "booking-view-pass:";

const sign = (payload: string) => createHmac("sha256", signingSecret()).update(PURPOSE + payload).digest("base64url");

const normalise = (reference: string) => reference.trim().toUpperCase();

export function createViewPass(reference: string, now: Date = new Date()): string {
  const payload = Buffer.from(
    JSON.stringify({ r: normalise(reference), e: now.getTime() + VIEW_PASS_MINUTES * 60_000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** True only for a genuine, unexpired pass issued for this booking. */
export function isValidViewPass(pass: string | undefined, reference: string, now: Date = new Date()): boolean {
  if (!pass) return false;
  const [payload, signature, extra] = pass.split(".");
  if (!payload || !signature || extra !== undefined) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { r, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { r?: unknown; e?: unknown };
    return r === normalise(reference) && typeof e === "number" && now.getTime() < e;
  } catch {
    return false;
  }
}

/** Cookie settings: sent only to this booking's page, unreadable by page scripts, gone after 60 minutes. */
export function viewPassCookie(reference: string, pass: string, { secure }: { secure: boolean }) {
  return {
    name: VIEW_PASS_COOKIE,
    value: pass,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: `/booking/${normalise(reference)}`,
    maxAge: VIEW_PASS_MINUTES * 60,
  };
}
