import { describe, expect, it } from "vitest";
import type { QuoteOption } from "@/lib/domain/types";
import { whatsappBookingLink } from "./whatsapp-booking";

describe("whatsappBookingLink", () => {
  it("sends the booking and quoted price to the office's WhatsApp", () => {
    const option = { vehicleId: "saloon", total: 7100 } as QuoteOption;
    const link = whatsappBookingLink([{ title: "Journey", rows: [["From", "1 Test Street, SW1A 1AA"], ["To", "Heathrow Airport, Terminal 5"]] }], option)!;
    expect(link.startsWith("https://wa.me/447470046660?text=")).toBe(true);
    const text = decodeURIComponent(link.split("text=")[1]);
    expect(text).toContain("From: 1 Test Street, SW1A 1AA");
    expect(text).toContain("To: Heathrow Airport, Terminal 5");
    expect(text).toContain("*Price quoted:* £71");
  });
});
