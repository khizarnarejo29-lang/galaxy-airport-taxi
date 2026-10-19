import { describe, expect, it } from "vitest";
import { adminPassword, createAdminSession, isValidAdminSession, passwordMatches } from "./session";

describe("admin session", () => {
  const now = new Date("2026-10-20T09:00:00Z");

  it("is off without a long enough password", () => {
    expect(adminPassword({})).toBeNull();
    expect(adminPassword({ ADMIN_PASSWORD: "short" })).toBeNull();
    expect(adminPassword({ ADMIN_PASSWORD: "a-long-password" })).toBe("a-long-password");
  });

  it("checks the password exactly", () => {
    expect(passwordMatches("a-long-password", "a-long-password")).toBe(true);
    expect(passwordMatches("a-long-passwor", "a-long-password")).toBe(false);
    expect(passwordMatches("", "a-long-password")).toBe(false);
  });

  it("accepts its own session for 12 hours, and nothing forged", () => {
    const session = createAdminSession(now);
    expect(isValidAdminSession(session, now)).toBe(true);
    expect(isValidAdminSession(session, new Date(now.getTime() + 11 * 3_600_000))).toBe(true);
    expect(isValidAdminSession(session, new Date(now.getTime() + 13 * 3_600_000))).toBe(false);
    const [payload] = session.split(".");
    expect(isValidAdminSession(`${Number(payload) + 1}.${session.split(".")[1]}`, now)).toBe(false);
    expect(isValidAdminSession(undefined, now)).toBe(false);
    expect(isValidAdminSession("abc", now)).toBe(false);
  });
});
