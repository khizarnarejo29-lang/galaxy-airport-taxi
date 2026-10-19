/**
 * The owner's admin login: one password (ADMIN_PASSWORD), and a signed,
 * HttpOnly cookie limited to /admin that lasts 12 hours.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { signingSecret } from "@/lib/quote/token";

export const ADMIN_COOKIE = "gat_admin";
export const ADMIN_SESSION_HOURS = 12;
// Kept apart from quote and booking-view signatures.
const PURPOSE = "admin-session:";

const sign = (payload: string) => createHmac("sha256", signingSecret()).update(PURPOSE + payload).digest("base64url");

const sameText = (a: string, b: string) => {
  const x = createHmac("sha256", PURPOSE).update(a).digest();
  const y = createHmac("sha256", PURPOSE).update(b).digest();
  return timingSafeEqual(x, y);
};

/** The admin password, or null when the admin page is switched off (no password set, or one under 10 characters). */
export function adminPassword(env: Partial<Record<string, string | undefined>> = process.env): string | null {
  const value = env.ADMIN_PASSWORD;
  return value && value.length >= 10 ? value : null;
}

export function passwordMatches(given: string, expected: string): boolean {
  return sameText(given, expected);
}

export function createAdminSession(now: Date = new Date()): string {
  const payload = String(now.getTime() + ADMIN_SESSION_HOURS * 3_600_000);
  return `${payload}.${sign(payload)}`;
}

export function isValidAdminSession(value: string | undefined, now: Date = new Date()): boolean {
  if (!value) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return now.getTime() < Number(payload);
}

export const adminCookie = (value: string, { secure }: { secure: boolean }) => ({
  name: ADMIN_COOKIE,
  value,
  httpOnly: true,
  secure,
  sameSite: "strict" as const,
  path: "/admin",
  maxAge: ADMIN_SESSION_HOURS * 3600,
});
