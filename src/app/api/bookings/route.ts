import { badRequest, bookingSchema, readJson } from "@/lib/api/schemas";
import { createBooking } from "@/lib/booking/create-booking";
import { getServices } from "@/lib/services";

export async function POST(request: Request) {
  const parsed = bookingSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest();

  const result = await createBooking(parsed.data, getServices());
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors, total: result.total }, { status: result.status });
  }
  return Response.json({ ok: true, reference: result.booking.reference }, { status: 201 });
}
