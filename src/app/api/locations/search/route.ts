import { fieldError } from "@/lib/domain/errors";
import { getServices } from "@/lib/services";
import { LocationLookupError } from "@/lib/services/location/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) return Response.json({ ok: true, results: [] });

  try {
    const results = await getServices().locations.search(q, params.get("session") ?? undefined);
    return Response.json(
      { ok: true, results },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } },
    );
  } catch (err) {
    if (!(err instanceof LocationLookupError)) throw err;
    console.error("[locations] lookup failed", err);
    return Response.json(
      { ok: false, errors: [fieldError("address", "LOCATION_LOOKUP_FAILED")] },
      { status: 502 },
    );
  }
}
