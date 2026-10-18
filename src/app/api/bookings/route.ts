import { cookies } from "next/headers";
import { badRequest, bookingSchema, readJson } from "@/lib/api/schemas";
import { site } from "@/config/site";
import { createBooking } from "@/lib/booking/create-booking";
import { startCheckout } from "@/lib/booking/payment";
import { createViewPass, viewPassCookie } from "@/lib/booking/view-pass";
import { getServices } from "@/lib/services";

export async function POST(request: Request) {
  const parsed = bookingSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest();

  const services = getServices();
  const result = await createBooking(parsed.data, services);
  if (!result.ok) {
    return Response.json({ ok: false, errors: result.errors, total: result.total }, { status: result.status });
  }

  // Only now that the booking is saved: let this browser see its full confirmation for 60 minutes.
  const { reference } = result.booking;
  (await cookies()).set(viewPassCookie(reference, createViewPass(reference), { secure: process.env.NODE_ENV === "production" }));
  // With card payments on, send the customer straight to the card page. If it can't be opened,
  // the booking still stands and its confirmation page offers to pay.
  const checkout = services.payments.checkout ? await startCheckout(reference, services, site.url) : null;
  return Response.json({ ok: true, reference, checkoutUrl: checkout?.ok ? checkout.url : undefined }, { status: 201 });
}
