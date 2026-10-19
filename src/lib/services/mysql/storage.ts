import "server-only";
import { randomUUID } from "node:crypto";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";
import type { Booking } from "@/lib/domain/types";
import { BookingReferenceTakenError, BookingStorageError, bookingToRow, type BookingRepository } from "../bookings";
import { quoteRequestToRow, type QuoteRequest, type QuoteRequestRepository } from "../quote-requests";

/**
 * Bookings and quote requests in a MySQL / MariaDB database, such as the one
 * Hostinger provides. Server-side only. The tables are in database/mysql.sql.
 */
export interface MysqlConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  /** Never logged or returned. */
  password: string;
}

type Env = Partial<Record<string, string | undefined>>;

/** All four settings (the port is optional), or null when any is missing. */
export function mysqlConfigFromEnv(env: Env = process.env): MysqlConfig | null {
  const host = env.MYSQL_HOST?.trim();
  const database = env.MYSQL_DATABASE?.trim();
  const user = env.MYSQL_USER?.trim();
  const password = env.MYSQL_PASSWORD;
  if (!host || !database || !user || !password) return null;
  return { host, port: Number(env.MYSQL_PORT) || 3306, database, user, password };
}

export function createMysqlPool(config: MysqlConfig): Pool {
  return createPool({ ...config, connectionLimit: 5, timezone: "Z", dateStrings: true });
}

const DUPLICATE_KEY = "ER_DUP_ENTRY";
/** MySQL wants "YYYY-MM-DD HH:MM:SS" in UTC, not ISO 8601 with a zone. */
const sqlTime = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 19).replace("T", " ") : null);
const failed = (operation: string, err: unknown) => new BookingStorageError(`Booking ${operation} failed`, (err as { code?: string })?.code);

function bookingValues(b: Booking) {
  const row = bookingToRow(b);
  return {
    reference: row.reference,
    status: row.status,
    trip_type: row.trip_type,
    vehicle_id: row.vehicle_id,
    pickup_at: sqlTime(row.pickup_at),
    return_pickup_at: sqlTime(row.return_pickup_at),
    total_pence: row.total_pence,
    pricing_version: row.pricing_version,
    reference_fare_id: row.reference_fare_id,
    reference_total_pence: row.reference_total_pence,
    payment_status: row.payment_status,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    review_flags: JSON.stringify(row.review_flags),
    booking: JSON.stringify(row.booking),
  };
}

const parse = <T>(value: unknown): T => (typeof value === "string" ? JSON.parse(value) : value) as T;

export function mysqlBookingRepository(pool: Pool): BookingRepository {
  return {
    async create(booking) {
      const values = bookingValues(booking);
      const cols = Object.keys(values);
      try {
        await pool.execute(`INSERT INTO bookings (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, Object.values(values));
      } catch (err) {
        if ((err as { code?: string }).code === DUPLICATE_KEY) throw new BookingReferenceTakenError();
        throw failed("save", err);
      }
    },
    async findByReference(reference) {
      try {
        const [rows] = await pool.execute<RowDataPacket[]>("SELECT booking FROM bookings WHERE reference = ?", [reference.trim().toUpperCase()]);
        return rows[0] ? parse<Booking>(rows[0].booking) : null;
      } catch (err) {
        throw failed("lookup", err);
      }
    },
    async exists(reference) {
      try {
        const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM bookings WHERE reference = ?", [reference.trim().toUpperCase()]);
        return rows.length > 0;
      } catch (err) {
        throw failed("lookup", err);
      }
    },
    async update(booking) {
      const { reference, ...rest } = bookingValues(booking);
      let affected = 0;
      try {
        const [result] = await pool.execute(
          `UPDATE bookings SET ${Object.keys(rest).map((c) => `${c} = ?`).join(", ")}, updated_at = UTC_TIMESTAMP() WHERE reference = ?`,
          [...Object.values(rest), reference],
        );
        affected = (result as { affectedRows?: number }).affectedRows ?? 0;
      } catch (err) {
        throw failed("update", err);
      }
      if (!affected) throw new BookingStorageError("Booking update failed");
    },
  };
}

export function mysqlQuoteRequestRepository(pool: Pool): QuoteRequestRepository {
  const toRequest = (r: RowDataPacket): QuoteRequest => ({
    id: r.id,
    status: r.status,
    createdAt: new Date(`${r.created_at}Z`).toISOString(),
    customer: { name: r.customer_name, phone: r.customer_phone, ...(r.customer_email ? { email: r.customer_email } : {}) },
    journeyKind: r.journey_kind,
    ...(r.airport ? { airport: r.airport } : {}),
    tripType: r.trip_type,
    pickupAtUtc: new Date(`${r.pickup_at}Z`).toISOString(),
    ...(r.pickup_postcode ? { pickupPostcode: r.pickup_postcode } : {}),
    ...(r.dropoff_postcode ? { dropoffPostcode: r.dropoff_postcode } : {}),
    reason: r.reason,
    journey: parse(r.journey),
    ...(r.message ? { message: r.message } : {}),
  });
  return {
    async create(request) {
      const id = randomUUID();
      const row = quoteRequestToRow(request);
      const values = { id, ...row, pickup_at: sqlTime(row.pickup_at), journey: JSON.stringify(row.journey) };
      const cols = Object.keys(values);
      try {
        await pool.execute(`INSERT INTO quote_requests (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, Object.values(values));
        const [rows] = await pool.execute<RowDataPacket[]>("SELECT * FROM quote_requests WHERE id = ?", [id]);
        return toRequest(rows[0]);
      } catch (err) {
        throw new BookingStorageError("Quote request save failed", (err as { code?: string })?.code);
      }
    },
    async list({ status, limit = 50 } = {}) {
      const n = Math.max(1, Math.min(500, Math.floor(limit)));
      try {
        const [rows] = status
          ? await pool.execute<RowDataPacket[]>(`SELECT * FROM quote_requests WHERE status = ? ORDER BY created_at DESC LIMIT ${n}`, [status])
          : await pool.execute<RowDataPacket[]>(`SELECT * FROM quote_requests ORDER BY created_at DESC LIMIT ${n}`);
        return rows.map(toRequest);
      } catch (err) {
        throw new BookingStorageError("Quote request lookup failed", (err as { code?: string })?.code);
      }
    },
  };
}
