import { describe, expect, it, vi } from "vitest";
import type { Booking } from "@/lib/domain/types";
import { BookingReferenceTakenError } from "../bookings";
import { createMysqlPool, mysqlBookingRepository, mysqlConfigFromEnv, mysqlQuoteRequestRepository } from "./storage";

vi.mock("server-only", () => ({}));

describe("mysqlConfigFromEnv", () => {
  it("needs host, database, user and password; the port defaults to 3306", () => {
    const env = { MYSQL_HOST: "localhost", MYSQL_DATABASE: "db", MYSQL_USER: "u", MYSQL_PASSWORD: "p" };
    expect(mysqlConfigFromEnv(env)).toEqual({ host: "localhost", port: 3306, database: "db", user: "u", password: "p" });
    expect(mysqlConfigFromEnv({ ...env, MYSQL_PORT: "3307" })?.port).toBe(3307);
    expect(mysqlConfigFromEnv({ ...env, MYSQL_PASSWORD: "" })).toBeNull();
    expect(mysqlConfigFromEnv({})).toBeNull();
  });
});

// Runs against a real database only when one is given, e.g. a local MariaDB with database/mysql.sql loaded.
const config = mysqlConfigFromEnv({
  MYSQL_HOST: process.env.MYSQL_TEST_HOST,
  MYSQL_PORT: process.env.MYSQL_TEST_PORT,
  MYSQL_DATABASE: process.env.MYSQL_TEST_DATABASE,
  MYSQL_USER: process.env.MYSQL_TEST_USER,
  MYSQL_PASSWORD: process.env.MYSQL_TEST_PASSWORD,
});

describe.skipIf(!config)("MySQL storage (real database)", () => {
  const reference = `GAT-T${String(Date.now() % 100000).padStart(5, "2").replace(/[01]/g, "2")}`;
  // Test fixture only — a made-up customer.
  const booking = {
    reference,
    status: "received",
    journey: { tripType: "one_way", pickupAtUtc: "2026-11-20T10:30:00.000Z", pickup: { kind: "airport", airport: "LHR" } },
    vehicleId: "saloon",
    total: 7100,
    pricingVersion: "test",
    customer: { name: "Sam Taylor", email: "sam@example.com", phone: "07700 900123" },
    payment: { status: "unpaid", method: "To be arranged" },
  } as unknown as Booking;

  it("saves, finds, refuses a duplicate and updates a booking", async () => {
    const pool = createMysqlPool(config!);
    const repo = mysqlBookingRepository(pool);
    await repo.create(booking);
    await expect(repo.create(booking)).rejects.toBeInstanceOf(BookingReferenceTakenError);
    expect(await repo.exists(reference.toLowerCase())).toBe(true);
    expect((await repo.findByReference(reference))?.total).toBe(7100);
    await repo.update({ ...booking, payment: { status: "paid", method: "Card (online)" } });
    expect((await repo.findByReference(reference))?.payment.status).toBe("paid");
    expect((await repo.list!(500)).some((b) => b.reference === reference)).toBe(true);
    expect(await repo.findByReference("GAT-NONE22")).toBeNull();
    await pool.end();
  });

  it("saves and lists quote requests", async () => {
    const pool = createMysqlPool(config!);
    const repo = mysqlQuoteRequestRepository(pool);
    const saved = await repo.create({
      customer: { name: "Sam Taylor", phone: "07700 900123" },
      journeyKind: "to_airport",
      airport: "LHR",
      tripType: "one_way",
      pickupAtUtc: "2026-11-20T10:30:00.000Z",
      reason: "NO_MATCHING_FARE",
      journey: {} as never,
    });
    expect(saved).toMatchObject({ status: "new", pickupAtUtc: "2026-11-20T10:30:00.000Z", airport: "LHR" });
    expect((await repo.list({ limit: 5 })).some((r) => r.id === saved.id)).toBe(true);
    await pool.end();
  });
});
