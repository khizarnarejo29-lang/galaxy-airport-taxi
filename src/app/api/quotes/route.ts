import { badRequest, journeySchema, readJson } from "@/lib/api/schemas";
import { createQuote } from "@/lib/quote/create-quote";
import { getServices } from "@/lib/services";

export async function POST(request: Request) {
  const parsed = journeySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest();

  const services = getServices();
  const result = await createQuote(parsed.data, services);
  if (!result.ok) return Response.json({ ok: false, errors: result.errors }, { status: result.status });
  // Lets the calculator say "Confirm and pay" when the card page follows the booking.
  return Response.json({ ok: true, quote: result.quote, token: result.token, cardPayments: Boolean(services.payments.checkout) });
}
