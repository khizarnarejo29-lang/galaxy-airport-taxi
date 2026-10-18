import { describe, expect, it, vi } from "vitest";
import type { Booking } from "@/lib/domain/types";
import { signQuote } from "@/lib/quote/token";
import { BookingStorageError, type BookingRepository } from "@/lib/services/bookings";
import { bookingView } from "./booking-view";
import { createViewPass, isValidViewPass, VIEW_PASS_COOKIE, viewPassCookie } from "./view-pass";

const now = new Date("2026-06-03T12:00:00Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

describe("viewing pass", () => {
  const pass = createViewPass("GAT-ABC234", now);

  it("is valid for its booking for 60 minutes, and not at 60 minutes", () => {
    expect(isValidViewPass(pass, "GAT-ABC234", now)).toBe(true);
    expect(isValidViewPass(pass, "gat-abc234", minutes(59))).toBe(true);
    expect(isValidViewPass(pass, "GAT-ABC234", new Date(minutes(60).getTime() - 1))).toBe(true);
    expect(isValidViewPass(pass, "GAT-ABC234", minutes(60))).toBe(false);
    expect(isValidViewPass(pass, "GAT-ABC234", minutes(600))).toBe(false);
  });

  it("only opens the booking it was issued for", () => {
    expect(isValidViewPass(pass, "GAT-ZZZ222", now)).toBe(false);
  });

  it("rejects missing, malformed and tampered passes", () => {
    const [payload, signature] = pass.split(".");
    const forged = Buffer.from(JSON.stringify({ r: "GAT-ZZZ222", e: minutes(60).getTime() })).toString("base64url");
    const extended = Buffer.from(JSON.stringify({ r: "GAT-ABC234", e: minutes(6000).getTime() })).toString("base64url");
    for (const bad of [undefined, "", "nonsense", `${payload}.`, `.${signature}`, `${forged}.${signature}`, `${extended}.${signature}`, `${payload}.${signature}x`, `${pass}.extra`]) {
      expect(isValidViewPass(bad, "GAT-ABC234", now)).toBe(false);
    }
  });

  it("can't be made from a quote token", () => {
    const token = signQuote({ journey: {}, options: [], pricingVersion: "x", issuedAt: "", expiresAt: "" } as never);
    expect(isValidViewPass(token, "GAT-ABC234", now)).toBe(false);
  });

  it("is kept in an HttpOnly cookie sent only to that booking's page, for 60 minutes", () => {
    expect(viewPassCookie("gat-abc234", pass, { secure: true })).toEqual({
      name: VIEW_PASS_COOKIE,
      value: pass,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/booking/GAT-ABC234",
      maxAge: 3600,
    });
    expect(viewPassCookie("GAT-ABC234", pass, { secure: false }).secure).toBe(false);
  });
});

// Test fixture only — a made-up customer.
const booking = {
  reference: "GAT-ABC234",
  customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
} as Booking;

function repo(overrides: Partial<BookingRepository> = {}): BookingRepository {
  return {
    create: async () => {},
    findByReference: async (r) => (r === "GAT-ABC234" ? booking : null),
    exists: async (r) => r === "GAT-ABC234",
    update: async () => {},
    ...overrides,
  };
}

describe("what the confirmation page may show", () => {
  const pass = createViewPass("GAT-ABC234", now);

  it("shows the full booking with a valid pass", async () => {
    expect(await bookingView("GAT-ABC234", pass, repo(), minutes(5))).toEqual({ kind: "full", booking });
  });

  it.each([
    ["no pass", undefined, minutes(5)],
    ["an expired pass", pass, minutes(60)],
    ["a pass for another booking", createViewPass("GAT-ZZZ222", now), minutes(5)],
    ["a tampered pass", `${pass}x`, minutes(5)],
  ])("shows only the reference with %s", async (_label, given, at) => {
    const view = await bookingView("gat-abc234", given, repo(), at);
    expect(view).toEqual({ kind: "restricted", reference: "GAT-ABC234" });
    expect(JSON.stringify(view)).not.toMatch(/Sam|example\.com|07700/);
  });

  it("doesn't read the booking at all without a valid pass", async () => {
    const findByReference = vi.fn();
    await bookingView("GAT-ABC234", undefined, repo({ findByReference }), minutes(5));
    expect(findByReference).not.toHaveBeenCalled();
  });

  it("reports unknown and malformed references as not found", async () => {
    expect(await bookingView("GAT-ZZZ222", undefined, repo(), minutes(5))).toEqual({ kind: "not_found" });
    expect(await bookingView("GAT-ZZZ222", createViewPass("GAT-ZZZ222", now), repo(), minutes(5))).toEqual({ kind: "not_found" });
    expect(await bookingView("not-a-reference", pass, repo(), minutes(5))).toEqual({ kind: "not_found" });
  });

  it("keeps the reference but shows no personal details when storage is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = repo({
      findByReference: async () => Promise.reject(new BookingStorageError("Booking lookup failed", "08006")),
      exists: async () => Promise.reject(new TypeError("fetch failed")),
    });
    expect(await bookingView("GAT-ABC234", pass, failing, minutes(5))).toEqual({ kind: "unavailable", reference: "GAT-ABC234" });
    expect(await bookingView("GAT-ABC234", undefined, failing, minutes(5))).toEqual({ kind: "unavailable", reference: "GAT-ABC234" });
    expect(log.mock.calls.flat().join(" ")).not.toMatch(/Sam|example\.com|07700/);
  });
});
