import { bookingRules } from "@/config/booking-rules";
import { activeTariff, pricing } from "@/config/pricing";
import { airports } from "@/lib/domain/airports";
import { centralLondonFrom } from "@/lib/pricing/example-fares";
import { formatGBP } from "@/lib/utils/money";
import type { Faq } from "./airports";
import { policies } from "./policies";

/**
 * Questions for the prices page. Every figure comes from the live tariff and
 * policies, so an answer can never quote a price the calculator wouldn't.
 */
export function priceFaqs(): Faq[] {
  if (!activeTariff()) return [];
  const { meetAndGreet, extraStop, childSeat } = pricing.extras;
  const events = pricing.eventSurcharges.filter((e) => e.enabled && e.multiplier > 1);

  const perAirport: Faq[] = airports.flatMap((a) => {
    const from = centralLondonFrom(a.code);
    return from === null
      ? []
      : [
          {
            q: `How much is a taxi from central London to ${a.shortName}?`,
            a: `From ${formatGBP(from)} one way in a saloon (up to 4 passengers). That is a fixed price for the whole car, with airport charges included. Larger vehicles cost more, and your exact price depends on your address: enter it in the calculator to see it.`,
          },
        ];
  });

  const extras = [
    meetAndGreet !== null && `Meet & Greet in the arrivals hall costs ${formatGBP(meetAndGreet)}`,
    extraStop !== null && `each extra stop costs ${formatGBP(extraStop)} plus the extra distance`,
    childSeat === 0 && `child seats are free (up to ${bookingRules.maxChildSeats})`,
  ].filter(Boolean);

  return [
    ...perAirport,
    {
      q: "Is the price per person?",
      a: "No. Every price is for the whole vehicle, however many passengers it carries, up to its seats.",
    },
    {
      q: "Is a return cheaper than two one-way trips?",
      a: "Yes. When you book a return, both journeys are priced lower than two separate one-way bookings.",
    },
    {
      q: "Are there any extra charges?",
      a: [
        extras.length ? `Only for extras you choose: ${extras.join(", ")}.` : null,
        policies.waitingTime ? "Waiting beyond the free time is charged by the minute, as set out in our terms." : null,
        events.length ? `Fares are higher at ${events.map((e) => e.label.replace(/ rate$/i, "")).join(" and ")}, and the calculator shows this before you book.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    },
  ];
}
