import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fleet } from "@/config/fleet";
import { airportCodes } from "@/lib/domain/airports";

const dir = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
const sql = files.map((f) => readFileSync(dir + f, "utf8")).join("\n");
const listIn = (column: string) => {
  const m = new RegExp(`${column}\\s+text not null check \\(${column} in \\(([^)]*)\\)\\)`).exec(sql);
  return m ? m[1].split(",").map((s) => s.trim().replace(/'/g, "")) : null;
};

describe("Supabase migration (static checks; never run here)", () => {
  it("exists and is marked as not applied", () => {
    expect(files).toEqual(["20261012120000_bookings_and_quote_requests.sql"]);
    expect(sql).toContain("NOT APPLIED");
  });

  it("turns Row Level Security on for both tables, with no policies and no public access", () => {
    for (const table of ["bookings", "quote_requests"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
      expect(sql).toContain(`revoke all on table public.${table} from anon, authenticated;`);
    }
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/grant /i);
  });

  it("protects references, prices and returns with constraints", () => {
    expect(sql).toContain("reference              text primary key check (reference ~ '^GAT-[2-9A-HJKMNP-Z]{6}$')");
    expect(sql).toContain("total_pence = reference_total_pence - 200");
    expect(sql).toContain("(trip_type = 'return') = (return_pickup_at is not null)");
    expect(sql).toContain("booking->>'reference' = reference");
  });

  it("matches the website's vehicles, airports and journey kinds", () => {
    expect(listIn("vehicle_id")).toEqual(fleet.map((v) => v.id));
    expect(listIn("journey_kind")).toEqual(["to_airport", "from_airport", "address_to_address"]);
    const airports = /airport\s+text check \(airport is null or airport in \(([^)]*)\)\)/.exec(sql)?.[1];
    expect(airports?.split(",").map((s) => s.trim().replace(/'/g, ""))).toEqual([...airportCodes]);
  });

  it("records quote requests by pickup and drop-off, with an airport only for airport journeys", () => {
    expect(sql).toContain("(journey_kind = 'address_to_address') = (airport is null)");
    expect(sql).toMatch(/pickup_postcode\s+text,/);
    expect(sql).toMatch(/dropoff_postcode\s+text,/);
    expect(sql).not.toMatch(/\bdirection\b|london_postcode/);
  });

  it("gives quote requests no price columns", () => {
    const table = /create table public\.quote_requests \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "";
    const columns = table.split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((c) => /^[a-z_]+$/.test(c));
    expect(columns.length).toBeGreaterThan(5);
    expect(columns.filter((c) => /price|total|pence|amount|fare/.test(c))).toEqual([]);
  });

  it("contains nothing destructive and no client-side keys", () => {
    expect(sql).not.toMatch(/\b(drop|truncate|delete from)\b/i);
    expect(sql).not.toMatch(/NEXT_PUBLIC/);
  });
});
