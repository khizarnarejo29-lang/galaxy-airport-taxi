import { cookies } from "next/headers";
import { badRequest, bookingSchema, readJson } from "@/lib/api/schemas";
import { createBooking } from "@/lib/booking/create-booking";
import { createViewPass, viewPassCookie } from "@/lib/booking/view-pass";
import { getServices } from "@/lib/services";

export async function POST(request: Request) {
  const parsed = bookingSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest();

  const result = await createBooking(parsed.data, getServices());
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors, total: result.total }, { status: result.status });
  }

  // Only now that the booking is saved: let this browser see its full confirmation for 60 minutes.
  const { reference } = result.booking;
  (await cookies()).set(viewPassCookie(reference, createViewPass(reference), { secure: process.env.NODE_ENV === "production" }));
  return Response.json({ ok: true, reference }, { status: 201 });
}
