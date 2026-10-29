/**
 * A plain-text summary of the business for AI assistants (the llms.txt
 * convention). Built from the same configuration as the pages, so it can't
 * state a price, policy or detail the website itself doesn't.
 */
import { bookingRules } from "@/config/booking-rules";
import { fleet } from "@/config/fleet";
import { site } from "@/config/site";
import { areas } from "@/content/areas";
import { policies } from "@/content/policies";
import { airports } from "@/lib/domain/airports";
import { centralLondonFrom } from "@/lib/pricing/example-fares";
import { formatGBP } from "@/lib/utils/money";

const absolute = (path: string) => new URL(path, site.url).toString();

export function llmsText(): string {
  const airportLines = airports.map((a) => {
    const from = centralLondonFrom(a.code);
    const price = from ? ` One way from central London from ${formatGBP(from)} (saloon).` : "";
    return `- [${a.name} taxi](${absolute(`/${a.slug}`)}): transfers to and from ${a.name} (${a.code}).${price}`;
  });

  const policyLines = [
    policies.waitingTime && `- Waiting time: ${policies.waitingTime}`,
    policies.flightDelays && `- Flight delays: ${policies.flightDelays}`,
    policies.cancellation && `- Cancellation: ${policies.cancellation}`,
    "- Child seats: free of charge.",
  ].filter(Boolean);

  return [
    `# ${site.name}`,
    "",
    `> Fixed-price taxis between any address in the United Kingdom and Heathrow, Gatwick, Stansted, Luton and London City airports, and for any other journey between two addresses (hospitals, stations, offices, long distance). Book online at ${absolute("/")}, 24 hours a day.`,
    "",
    "## Key facts",
    "",
    `- Phone: ${site.phone.display}`,
    ...(site.whatsapp ? [`- WhatsApp: ${site.whatsapp.display}`] : []),
    `- Email: ${site.email}`,
    ...(site.address ? [`- Address: ${site.address}`] : []),
    ...(site.openingHours ? [`- Hours: ${site.openingHours}`] : []),
    "- Area served: the whole of the United Kingdom: to and from the five London airports, and between any two addresses.",
    `- Vehicles: ${fleet.map((v) => `${v.name} (up to ${v.maxPassengers} passengers)`).join(", ")}.`,
    "- Prices: one fixed total per vehicle for the whole booking, shown before booking. Prices are for the vehicle, not per person. A return costs less than two one-way trips.",
    `- Booking: online with at least ${bookingRules.minNoticeMinutes / 60} hours' notice, up to ${bookingRules.maxDaysAhead} days ahead. Sooner journeys by phone or WhatsApp.`,
    "",
    "## Airports",
    "",
    ...airportLines,
    "",
    "## Policies",
    "",
    ...policyLines,
    "",
    "## Pages",
    "",
    `- [Get a quote](${absolute("/quote")}): instant fixed price and online booking.`,
    `- [Airport transfers](${absolute("/airport-transfers")}): how drop-offs, pickups and prices work.`,
    `- [Prices](${absolute("/prices")}): fixed one-way prices from six London areas to each airport, for every vehicle.`,
    `- [Local taxi](${absolute("/taxi")}): any journey between two addresses, such as hospitals, stations, offices and long-distance trips, with example prices.`,
    ...areas.map((a) => `- [${a.name} taxi](${absolute(`/taxi/${a.slug}`)}): airport transfers and local rides from ${a.name}.`),
    `- [Fleet](${absolute("/fleet")}): vehicle types and capacity.`,
    `- [Meet and Greet](${absolute("/services/meet-and-greet")}): driver waits in the arrivals hall with a name sign.`,
    `- [Corporate travel](${absolute("/services/corporate-travel")}): business and client transfers.`,
    `- [FAQ](${absolute("/faq")}): questions about quotes, booking, waiting and cancellation.`,
    `- [Contact](${absolute("/contact")})`,
    `- [Terms and Conditions](${absolute("/terms")})`,
    `- [Privacy Policy](${absolute("/privacy")})`,
    "",
  ].join("\n");
}
