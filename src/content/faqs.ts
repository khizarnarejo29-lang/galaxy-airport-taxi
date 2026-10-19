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
          q: "How is my price shown?",
          a: "Where we can price your journey online, each vehicle shows one fixed total for the whole booking, including both journeys of a return. If we can't, it shows “Price on request”.",
        },
        {
          q: "What does “Price on request” mean?",
          a: `We can't confirm an instant price for that journey online, for example because of the exact address, date, luggage, stops or extras. Please call us on ${site.phone.display} and we'll give you a fixed price. Phone is currently the most reliable way to get a quote.`,
        },
        {
          q: "How long is my quote valid?",
          a: `Your price is held for ${bookingRules.quoteValidityMinutes} minutes while you complete your booking. After that, the calculator refreshes the quote and tells you if anything has changed.`,
        },
        {
          q: "Why can't I choose some vehicles?",
          a: `You can only book a vehicle online when it has a confirmed price for your journey. Others show “Price on request”. Call us on ${site.phone.display} and we'll help.`,
        },
      ],
    },
    {
      title: "Booking",
      items: [
        {
          q: "Which areas do you cover?",
          a: `Journeys between any address in ${serviceArea.label}, London included, and Heathrow, Gatwick, Stansted, Luton and London City airports, in either direction. Enter your postcode in the calculator for a fixed price.`,
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
          a: `Yes. You can add up to ${bookingRules.maxExtraStops} extra stops when you enter your journey. Journeys with stops may show “Price on request”. If so, please call us for a price.`,
        },
        {
          q: "Can I request a child seat?",
          a: `Yes. You can request up to ${bookingRules.maxChildSeats} child seats in the extras step, before you see prices. Some journeys with child seats may show “Price on request”. If so, please call us.`,
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
