import { bookingRules } from "@/config/booking-rules";
import { pricing } from "@/config/pricing";
import { site } from "@/config/site";
import { formatGBP } from "@/lib/utils/money";
import { cancellationPolicy, policies } from "./policies";

export interface TermsSection {
  id: string;
  title: string;
  paragraphs: string[];
}

/** Date this version of the terms was written. Update whenever the terms change. */
export const termsLastUpdated = "20 October 2026";

const price = (pence: number | null) => (pence ? formatGBP(pence) : null);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "24 December, 6pm" from an MM-DD date and HH:mm time; the end of a window reads as the end of that day. */
function when({ date, time }: { date: string; time: string }, end = false) {
  const [m, d] = date.split("-").map(Number);
  const day = `${d} ${MONTHS[m - 1]}`;
  if (end && time === "23:59") return `the end of ${day}`;
  const [h, min] = time.split(":").map(Number);
  return `${day}, ${h % 12 || 12}${min ? `:${String(min).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/**
 * Galaxy Airport Taxi Terms and Conditions, from the policies the owner has
 * set (policies.ts) and the live prices (config/pricing.ts), so the page and
 * the calculator always agree. SUBJECT TO FINAL LEGAL REVIEW.
 */
export function termsSections(): TermsSection[] {
  const days = cancellationPolicy.refundProcessingBusinessDays;
  const meetAndGreet = price(pricing.extras.meetAndGreet);
  const stop = price(pricing.extras.extraStop);
  const events = pricing.eventSurcharges.filter((e) => e.enabled && e.multiplier > 1);
  return [
    {
      id: "about",
      title: "About these terms",
      paragraphs: [
        `These terms apply to every journey booked with ${site.name} ("we", "us", "our") on this website, by phone, by email or on WhatsApp. By making a booking you agree to them.`,
      ],
    },
    {
      id: "bookings",
      title: "Bookings",
      paragraphs: [
        `Online bookings need at least ${bookingRules.minNoticeMinutes / 60} hours' notice and can be made up to ${bookingRules.maxDaysAhead} days ahead. For anything sooner, please call us on ${site.phone.display}.`,
        "When your booking is made you get a booking reference. Please check the details we send you, and tell us straight away if anything is wrong.",
        "Please give us the correct pickup address, date and time, the number of passengers and the luggage you are bringing. For airport pickups, give us your flight number so we can follow your flight.",
      ],
    },
    {
      id: "prices",
      title: "Prices",
      paragraphs: [
        "The price shown when you book is a fixed price for the whole vehicle, not per person. It includes airport drop-off and parking charges for your journey.",
        ...(events.length
          ? [
              `The journey fare is doubled at ${events
                .map((e) => `${e.label.replace(/ rate$/i, "")} (${when(e.from)} to ${when(e.to, true)})`)
                .join(" and ")}. The calculator shows this before you book.`,
            ]
          : []),
        [
          meetAndGreet && `Meet & Greet (your driver meets you in the arrivals hall) costs ${meetAndGreet}.`,
          stop && `Each extra stop costs ${stop}, plus the extra distance.`,
          pricing.extras.childSeat === 0 && `Child seats are free (up to ${bookingRules.maxChildSeats} per booking).`,
        ]
          .filter(Boolean)
          .join(" "),
        "Waiting time beyond the free period (see below) is charged separately.",
      ].filter((p) => p.length > 0),
    },
    {
      id: "passengers-and-luggage",
      title: "Passengers and luggage",
      paragraphs: [
        "The vehicle you book must be right for the number of passengers and the luggage you tell us about. If you bring more, the driver may not be able to take everyone safely, and we may need to send a larger vehicle at an extra cost or end the booking.",
        "Large or unusual items, such as bikes, golf bags or pushchairs, must be agreed with us before you travel.",
        "Every passenger must wear a seat belt. Children must use a suitable child seat; please request the seats you need when you book.",
      ],
    },
    { id: "waiting-time", title: "Waiting time", paragraphs: policies.waitingTime ? [policies.waitingTime] : [] },
    { id: "flight-delays", title: "Flight delays", paragraphs: policies.flightDelays ? [policies.flightDelays] : [] },
    {
      id: "cancellation-and-refunds",
      title: "Booking cancellation and refunds",
      paragraphs: [
        `If you cancel a booking and the cancellation is eligible for a refund under the applicable cancellation policy, we will process your refund within ${days} business days.`,
        `This ${days}-business-day period is the time we take to process the refund. After that, your bank or card provider may need additional time before the funds appear in your account.`,
        ...cancellationPolicy.additionalRules,
      ],
    },
    {
      id: "changes",
      title: "Changes to your booking",
      paragraphs: [
        `To change a booking, email ${site.email} or call ${site.phone.display}, quoting your booking reference. If the change affects the price, for example a different address or a larger vehicle, we will tell you the new price before we make the change.`,
      ],
    },
    {
      id: "our-responsibilities",
      title: "Our responsibilities",
      paragraphs: [
        "We will do our best to collect you at the agreed time and take you to your destination by a sensible route. Journey times can be affected by traffic, roadworks, weather and other things outside our control, so please allow enough time for your flight.",
        "If we can't provide your journey, we will tell you as soon as we can and refund anything you have paid for it.",
        "Nothing in these terms limits your rights under UK consumer law, or our responsibility where the law doesn't allow it to be limited.",
      ],
    },
    {
      id: "complaints",
      title: "Questions and complaints",
      paragraphs: [
        `If something isn't right, please tell us as soon as possible by emailing ${site.email} or calling ${site.phone.display}, quoting your booking reference. We will look into it and reply.`,
      ],
    },
    {
      id: "law",
      title: "Law",
      paragraphs: ["These terms are governed by the law of England and Wales."],
    },
  ].filter((s) => s.paragraphs.length > 0);
}
