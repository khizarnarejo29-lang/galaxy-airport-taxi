import { site } from "@/config/site";
import type { QuoteOption } from "@/lib/domain/types";
import { formatGBP } from "@/lib/utils/money";

/**
 * A WhatsApp message carrying the whole booking, for while online bookings
 * can't be saved: the customer sends it and the office confirms by reply.
 */
export function whatsappBookingLink(sections: { title: string; rows: [string, string][] }[], option: QuoteOption): string | null {
  if (!site.whatsapp) return null;
  const lines = [
    "Hello Galaxy Airport Taxi, I would like to book this journey:",
    ...sections.flatMap((s) => ["", `*${s.title}*`, ...s.rows.map(([k, v]) => `${k}: ${v}`)]),
    "",
    `*Price quoted:* ${formatGBP(option.total)}`,
  ];
  const number = site.whatsapp.href.match(/wa\.me\/(\d+)/)?.[1];
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}` : null;
}
