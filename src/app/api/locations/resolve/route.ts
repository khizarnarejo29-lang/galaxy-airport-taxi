import { fieldError } from "@/lib/domain/errors";
import { getServices } from "@/lib/services";
import { LocationLookupError } from "@/lib/services/location/types";

/** The full location (point, postcode, street) for a search suggestion the customer chose. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim() ?? "";
  if (!id || id.length > 320) return Response.json({ ok: false, errors: [fieldError("address", "ADDRESS_REQUIRED")] }, { status: 422 });

  try {
    const location = await getServices().locations.resolve(id, params.get("session") ?? undefined);
    if (!location) return Response.json({ ok: false, errors: [fieldError("address", "ADDRESS_REQUIRED")] }, { status: 404 });
    return Response.json({ ok: true, location }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    if (!(err instanceof LocationLookupError)) throw err;
    console.error("[locations] resolve failed", err);
    return Response.json({ ok: false, errors: [fieldError("address", "LOCATION_LOOKUP_FAILED")] }, { status: 502 });
  }
}
