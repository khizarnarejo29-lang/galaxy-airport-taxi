import { badRequest, journeySchema, readJson } from "@/lib/api/schemas";
import { createQuote } from "@/lib/quote/create-quote";
import { getServices } from "@/lib/services";

export async function POST(request: Request) {
  const parsed = journeySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest();

  const result = await createQuote(parsed.data, getServices());
  if (!result.ok) return Response.json({ ok: false, errors: result.errors }, { status: result.status });
  return Response.json({ ok: true, quote: result.quote, token: result.token });
}
