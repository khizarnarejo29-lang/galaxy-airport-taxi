import { site } from "@/config/site";
import { getVehicle } from "@/config/fleet";
import { getAirport } from "@/lib/domain/airports";
import { contactTopics, type ContactInput } from "@/lib/domain/contact";
import type { Booking } from "@/lib/domain/types";
import { formatJourneyDate } from "@/lib/utils/dates";
import { formatGBP } from "@/lib/utils/money";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Key/value rows describing a booking, shared by every template and the confirmation page. */
export function bookingSummaryRows(b: Booking): [string, string][] {
  const airport = getAirport(b.journey.airport)!;
  const terminal = airport.terminals.find((t) => t.id === b.journey.terminal)?.name;
  const airportLabel = terminal ? `${airport.name}, ${terminal}` : airport.name;
  const address = [b.journey.address.line1, b.journey.address.postcode ?? b.journey.address.label]
    .filter(Boolean)
    .join(", ");
  const toAirport = b.journey.direction === "to_airport";

  const rows: [string, string][] = [
    ["Booking reference", b.reference],
    ["Pickup", toAirport ? address : airportLabel],
    ["Destination", toAirport ? airportLabel : address],
    ...b.journey.extraStops.map((s, i): [string, string] => [`Stop ${i + 1}`, s.line1 ? `${s.line1}, ${s.label}` : s.label]),
    ["Date", formatJourneyDate(b.journey.date)],
    [toAirport ? "Pickup time" : "Flight landing time", b.journey.time],
  ];
  if (b.journey.flightNumber) rows.push(["Flight number", b.journey.flightNumber]);
  rows.push(
    ["Vehicle", getVehicle(b.vehicleId)?.name ?? b.vehicleId],
    ["Passengers", String(b.journey.passengers)],
    ["Luggage", `${b.journey.luggage.large} large, ${b.journey.luggage.small} small`],
  );
  if (b.addOns.meetAndGreet && !toAirport) rows.push(["Meet & Greet", "Yes"]);
  if (b.addOns.childSeats) rows.push(["Child seats", String(b.addOns.childSeats)]);
  if (b.specialRequirements) rows.push(["Special requirements", b.specialRequirements]);
  if (b.notes) rows.push(["Notes", b.notes]);
  rows.push(["Total fare", formatGBP(b.total)]);
  return rows;
}

function render(heading: string, intro: string, rows: [string, string][]) {
  const text = [heading, "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", site.name].join("\n");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#10142b;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:22px;margin:0 0 12px">${escape(heading)}</h1>
<p style="margin:0 0 20px;line-height:1.5">${escape(intro)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7f0;color:#5b6184">${escape(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e5e7f0;text-align:right;font-weight:600">${escape(v)}</td></tr>`,
    )
    .join("")}</table>
<p style="margin:24px 0 0;font-size:13px;color:#5b6184">${escape(site.name)} · ${escape(site.phone.display)} · ${escape(site.email)}</p>
</body></html>`;
  return { text, html };
}

export function bookingReceivedCustomerEmail(b: Booking): EmailMessage {
  const { text, html } = render(
    "We've received your booking",
    `Thank you, ${b.customer.name}. Your booking reference is ${b.reference}. Please keep it handy if you need to contact us about this journey.`,
    bookingSummaryRows(b),
  );
  return { to: b.customer.email, subject: `Booking received: ${b.reference}`, text, html };
}

export function newBookingOperatorEmail(b: Booking, to: string): EmailMessage {
  const { text, html } = render(
    `New booking ${b.reference}`,
    `${b.customer.name} · ${b.customer.phone} · ${b.customer.email}`,
    bookingSummaryRows(b),
  );
  return { to, subject: `New booking ${b.reference} (${formatJourneyDate(b.journey.date)} ${b.journey.time})`, text, html };
}

export function contactEnquiryEmail(input: ContactInput, to: string): EmailMessage {
  const rows: [string, string][] = [
    ["Topic", contactTopics[input.topic]],
    ["Name", input.name],
    ["Email", input.email],
    ...(input.phone ? [["Phone", input.phone] as [string, string]] : []),
    ...(input.bookingReference ? [["Booking reference", input.bookingReference] as [string, string]] : []),
    ["Message", input.message],
  ];
  const { text, html } = render(`New enquiry: ${contactTopics[input.topic]}`, `From ${input.name}`, rows);
  return { to, subject: `Website enquiry from ${input.name}`, text, html };
}
