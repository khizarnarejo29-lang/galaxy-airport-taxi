import { cookies } from "next/headers";
import { site } from "@/config/site";
import { startCheckout } from "@/lib/booking/payment";
import { isValidViewPass, VIEW_PASS_COOKIE } from "@/lib/booking/view-pass";
import { getServices } from "@/lib/services";

/** "Pay by card" on the confirmation page: opens a card checkout for this booking's saved total. */
export async function POST(_request: Request, { params }: RouteContext<"/booking/[reference]/pay">) {
  const { reference } = await params;
  const page = `/booking/${encodeURIComponent(reference.trim().toUpperCase())}`;
  const back = (payment: string) => new Response(null, { status: 303, headers: { Location: `${page}?payment=${payment}` } });

  // Only the browser that made the booking holds a pass for it.
  if (!isValidViewPass((await cookies()).get(VIEW_PASS_COOKIE)?.value, reference)) return back("expired");

  const result = await startCheckout(reference, getServices(), site.url);
  if (result.ok) return new Response(null, { status: 303, headers: { Location: result.url } });
  return back(result.reason === "already_paid" ? "success" : "error");
}
