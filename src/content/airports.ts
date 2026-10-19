import { bookingRules } from "@/config/booking-rules";
import type { AirportCode } from "@/lib/domain/types";
import { policies } from "./policies";

export interface Faq {
  q: string;
  a: string;
}

export interface AirportContent {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  lead: string;
  /** Where the airport is, in plain terms. Distances are approximate, by road. */
  location: string;
  terminalsIntro: string;
  /** Short notes shown per terminal id (optional). */
  terminalNotes?: Record<string, string>;
  dropOff: string;
  pickup: string;
  faqs: Faq[];
}

/**
 * Airport landing-page copy. Facts only: locations, terminals and how the
 * booking system handles each direction. No journey-time or punctuality claims.
 */
export const airportContent: Record<AirportCode, AirportContent> = {
  LHR: {
    metaTitle: "Heathrow Airport Taxi to and from London",
    metaDescription:
      "Fixed-price taxi between any UK address and Heathrow Terminals 2, 3, 4 and 5. Book online 24/7, with 60 minutes' free waiting after you land.",
    h1: "Heathrow airport taxi",
    lead: "Transfers between your address, in London or anywhere in the UK, and any of Heathrow's four terminals, with a fixed price agreed before you book.",
    location:
      "Heathrow sits on the western edge of Greater London in the borough of Hillingdon, roughly 15 miles from central London by road.",
    terminalsIntro:
      "Heathrow has four passenger terminals. Your airline and booking confirmation will tell you which one you need. Check it before you travel, because airlines do move terminals from time to time.",
    dropOff:
      "Choose the terminal you're departing from and we'll take you to its drop-off area.",
    pickup:
      "Enter your flight number and scheduled landing time when you book. Both are saved with your booking so the pickup is matched to your arrival.",
    faqs: [
      {
        q: "Which Heathrow terminal should I choose?",
        a: "Pick the terminal shown on your flight booking. If you're not sure, your airline's website lists the terminal it uses at Heathrow.",
      },
      {
        q: "What does the price include?",
        a: "One fixed total for the whole vehicle, with airport charges included. Child seats are free. Meet & Greet in the arrivals hall is an optional extra, shown in your price before you book.",
      },
      {
        q: "What do I need to book a Heathrow pickup?",
        a: "Your terminal, flight number, scheduled landing time, the address you are going to, and how many passengers and bags are travelling.",
      },
    ],
  },
  LGW: {
    metaTitle: "Gatwick Airport Taxi to and from London",
    metaDescription:
      "Fixed-price taxi between any UK address and Gatwick North or South Terminal. Book online 24/7, with 60 minutes' free waiting after you land.",
    h1: "Gatwick airport taxi",
    lead: "Door-to-door transfers between London and Gatwick's North and South terminals, with a fixed price agreed before you book.",
    location:
      "Gatwick is in West Sussex, near Crawley, roughly 30 miles south of central London by road.",
    terminalsIntro:
      "Gatwick has two terminals, North and South, connected by a free shuttle. Your booking confirmation shows which terminal your airline uses.",
    dropOff:
      "Select North or South Terminal and you'll be dropped at that terminal's departures area.",
    pickup:
      "Add your flight number and landing time when you book. They're stored with your booking so the pickup can be matched to your flight.",
    faqs: [
      {
        q: "How do I know if I need North or South Terminal?",
        a: "Your airline decides the terminal. It's printed on your booking confirmation and listed on the airline's website.",
      },
      {
        q: "Do you cover the whole of London for Gatwick transfers?",
        a: "Yes, and the rest of the UK too. Enter any UK postcode or address in the calculator to see a fixed price for your Gatwick transfer.",
      },
      {
        q: "What if I'm travelling with lots of luggage?",
        a: "Enter how many suitcases and bags you have in the calculator and choose a vehicle with room for them, such as an estate or MPV. For large items like bikes or golf bags, please call or WhatsApp us before booking.",
      },
    ],
  },
  STN: {
    metaTitle: "Stansted Airport Taxi to and from London",
    metaDescription:
      "Fixed-price taxi between any UK address and Stansted Airport, from saloons to 8-seaters. Book online 24/7, with 60 minutes' free waiting after you land.",
    h1: "Stansted airport taxi",
    lead: "Transfers between London and Stansted's single terminal, with a fixed price agreed before you book.",
    location: "Stansted is in Essex, roughly 35 miles north-east of central London by road.",
    terminalsIntro:
      "Stansted has one passenger terminal for all departures and arrivals, so there's no terminal to choose when you book.",
    dropOff:
      "You'll be taken to the terminal's drop-off area.",
    pickup:
      "Give us your flight number and landing time when booking. They're kept with your booking so the pickup lines up with your arrival.",
    faqs: [
      {
        q: "Do I need to choose a terminal at Stansted?",
        a: "No. Stansted has a single terminal, so the calculator skips that question.",
      },
      {
        q: "Can I add a stop on the way to Stansted?",
        a: "Yes. You can add up to two extra stops in the first step of the calculator. Each stop is added to your fixed price, so you see the full total before you book.",
      },
    ],
  },
  LTN: {
    metaTitle: "Luton Airport Taxi to and from London",
    metaDescription:
      "Fixed-price taxi between any UK address and London Luton Airport. Book online 24/7, with 60 minutes' free waiting after you land.",
    h1: "Luton airport taxi",
    lead: "Transfers between your address, in London or anywhere in the UK, and London Luton Airport, with a fixed price agreed before you book.",
    location: "London Luton Airport is in Bedfordshire, roughly 30 miles north of central London by road.",
    terminalsIntro:
      "Luton has a single passenger terminal, so you won't be asked to choose one when you book.",
    dropOff:
      "You'll be dropped at the terminal's drop-off area.",
    pickup:
      "Enter your flight number and landing time when booking so the pickup is matched to your flight.",
    faqs: [
      {
        q: "Is Luton Airport inside London?",
        a: "No. Despite its name, it's in Bedfordshire, north of the M25. We cover journeys between Luton Airport and any address in London or elsewhere in the UK.",
      },
      {
        q: "Which vehicle should I choose for a family trip to Luton?",
        a: "Enter your passengers and luggage in the calculator, and it shows the vehicles that fit with a fixed price for each. Families often choose an estate or MPV, and child seats are free.",
      },
    ],
  },
  LCY: {
    metaTitle: "London City Airport Taxi",
    metaDescription:
      "Fixed-price taxi between any UK address and London City Airport. Book online 24/7, with 60 minutes' free waiting after you land.",
    h1: "London City Airport taxi",
    lead: "Transfers between London City Airport and addresses across London and the rest of the UK, with a fixed price agreed before you book.",
    location:
      "London City Airport is in the Royal Docks in east London, roughly 7 miles east of the City of London.",
    terminalsIntro: "London City has a single terminal, so there's no terminal to pick.",
    dropOff:
      "You'll be taken to the terminal's drop-off point.",
    pickup:
      "Add your flight number and landing time when booking. They're saved with your booking so the pickup matches your arrival.",
    faqs: [
      {
        q: "Is London City Airport good for business trips?",
        a: "It's the closest of the five airports to Canary Wharf and the City. For regular business travel, see our corporate travel page.",
      },
      {
        q: "Can I book a London City transfer for a short-notice flight?",
        a: `Online bookings need at least ${bookingRules.minNoticeMinutes / 60} hours' notice. For anything sooner, please call or WhatsApp us and we'll tell you what's possible.`,
      },
    ],
  },
};

/**
 * The airport's own questions, then the confirmed policies every airport shares
 * (waiting time, flight delays, child seats). Policies not yet written are skipped.
 */
export function airportFaqs(code: AirportCode, shortName: string): Faq[] {
  const shared: (Faq | null)[] = [
    policies.waitingTime ? { q: `How long will the driver wait at ${shortName}?`, a: policies.waitingTime } : null,
    policies.flightDelays ? { q: "What if my flight is delayed?", a: policies.flightDelays } : null,
    { q: "Are child seats free?", a: "Yes. Child seats are free of charge. Tell us how many you need in the extras step when you book." },
  ];
  return [...airportContent[code].faqs, ...shared.filter((f): f is Faq => f !== null)];
}
