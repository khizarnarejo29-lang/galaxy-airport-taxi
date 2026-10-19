import { fieldError } from "@/lib/domain/errors";
import type { FieldError, JourneyInput, LocationSearchResult, Quote, ResolvedLocation } from "@/lib/domain/types";
import type { BookingRequest } from "@/lib/booking/create-booking";

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; status: number; errors: FieldError[]; total?: number };

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const body = await res.json().catch(() => null);
    if (body && typeof body === "object" && "ok" in body) {
      return body.ok ? body : { ...body, status: res.status };
    }
    return { ok: false, status: res.status, errors: [fieldError("request", "SERVER_ERROR")] };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    return { ok: false, status: 0, errors: [fieldError("request", "SERVER_ERROR")] };
  }
}

export function searchLocations(q: string, session: string, signal: AbortSignal) {
  return call<{ results: LocationSearchResult[] }>(
    `/api/locations/search?q=${encodeURIComponent(q)}&session=${encodeURIComponent(session)}`,
    { signal },
  );
}

/** The full location for a suggestion the customer chose. */
export function resolveLocation(id: string, session: string) {
  return call<{ location: ResolvedLocation }>(
    `/api/locations/resolve?id=${encodeURIComponent(id)}&session=${encodeURIComponent(session)}`,
  );
}

export function requestQuote(journey: JourneyInput) {
  return call<{ quote: Quote; token: string; cardPayments?: boolean; onlineBooking?: boolean }>("/api/quotes", { method: "POST", body: JSON.stringify(journey) });
}

export function submitBooking(request: BookingRequest) {
  return call<{ reference: string; checkoutUrl?: string }>("/api/bookings", { method: "POST", body: JSON.stringify(request) });
}
