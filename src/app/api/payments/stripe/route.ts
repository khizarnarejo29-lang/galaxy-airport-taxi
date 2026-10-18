import { recordPayment } from "@/lib/booking/payment";
import { getServices } from "@/lib/services";

/** Stripe's payment notifications (webhook). The signature is checked before anything is read. */
export async function POST(request: Request) {
  const services = getServices();
  const { readNotification } = services.payments;
  if (!readNotification) return new Response(null, { status: 404 });

  const body = await request.text();
  let payment;
  try {
    payment = readNotification(body, request.headers.get("stripe-signature"));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!payment) return Response.json({ received: true });

  try {
    await recordPayment(payment, services);
  } catch (err) {
    // Stripe retries on an error status, so a storage hiccup doesn't lose the payment.
    console.error(`[payment ${payment.sessionId}] could not be recorded`, err instanceof Error ? err.message : err);
    return new Response(null, { status: 500 });
  }
  return Response.json({ received: true });
}
