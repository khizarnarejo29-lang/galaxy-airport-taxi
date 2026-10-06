import { bookingRules } from "@/config/booking-rules";
import { serviceArea } from "@/config/service-area";
import { site } from "@/config/site";
import type { Faq } from "./airports";
import { policies } from "./policies";

export interface FaqGroup {
  title: string;
  items: Faq[];
}

/**
 * General FAQs. Answers are built from configuration so they always match the
 * booking system; policy questions only appear once that policy is written.
 */
export function faqGroups(): FaqGroup[] {
  const policyFaqs: Faq[] = [
    policies.waitingTime && { q: "How long will the driver wait?", a: policies.waitingTime },
    policies.flightDelays && { q: "What happens if my flight is delayed or early?", a: policies.flightDelays },
    policies.cancellation && { q: "Can I cancel or change my booking?", a: policies.cancellation },
    policies.payment && { q: "How do I pay?", a: policies.payment },
  ].filter((f): f is Faq => Boolean(f));

  return [
    {
      title: "Quotes and prices",
      items: [
        {
          q: "How is my price worked out?",
          a: "Your quote depends on the airport, the distance to or from your address, the vehicle you choose and any extras you add. Each part is shown as a separate line before you book, so you can see exactly what makes up the total.",
        },
        {
          q: "Are airport charges included?",
          a: "Yes. Where an airport charges for dropping off or for parking while your driver collects you, the charge appears in your quote and is included in the total.",
        },
        {
          q: "How long is my quote valid?",
          a: `Your price is held for ${bookingRules.quoteValidityMinutes} minutes while you complete your booking. After that, the calculator refreshes the quote and tells you if anything has changed.`,
        },
        {
          q: "Why can't I choose some vehicles?",
          a: "The calculator only offers vehicles with enough seats and luggage space for the passengers and bags you entered. Vehicles that don't fit are shown with the reason.",
        },
      ],
    },
    {
      title: "Booking",
      items: [
        {
          q: "Which areas do you cover?",
          a: `Online quotes cover journeys between addresses in ${serviceArea.label} and Heathrow, Gatwick, Stansted, Luton and London City airports. If your address is outside this area, the calculator will say so and you're welcome to call us.`,
        },
        {
          q: "How far in advance do I need to book?",
          a: `Online bookings need at least ${bookingRules.minNoticeMinutes / 60} hours' notice and can be made up to ${bookingRules.maxDaysAhead} days ahead. For anything sooner, please call us on ${site.phone.display}.`,
        },
        {
          q: "Why do you need my flight number?",
          a: "For pickups from the airport, your flight number is saved with your booking so the pickup can be matched to your arrival. For drop-offs it's optional.",
        },
        {
          q: "Can I add stops along the way?",
          a: `Yes. You can add up to ${bookingRules.maxExtraStops} extra stops when you enter your journey. Each stop is priced and shown in your quote.`,
        },
        {
          q: "Can I request a child seat?",
          a: `Yes. You can request up to ${bookingRules.maxChildSeats} child seats in the extras section before you book. They're priced as a separate line in your quote.`,
        },
        {
          q: "What happens after I book?",
          a: "You'll see a confirmation page with your booking reference and journey details. Keep the reference handy in case you need to contact us about your booking.",
        },
        ...policyFaqs,
      ],
    },
  ];
}
