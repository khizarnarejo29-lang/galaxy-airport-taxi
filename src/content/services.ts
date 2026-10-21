import type { IconName } from "@/components/ui/Icon";

export interface ServiceSummary {
  slug: string | null;
  href: string;
  icon: IconName;
  title: string;
  summary: string;
}

/** Services shown on the services overview, homepage and navigation. */
export const services: ServiceSummary[] = [
  {
    slug: null,
    href: "/airport-transfers",
    icon: "plane",
    title: "Airport transfers",
    summary: "To departures and from arrivals at all five London airports, from anywhere in the UK, with your flight number saved for pickups.",
  },
  {
    slug: null,
    href: "/taxi",
    icon: "route",
    title: "Local rides",
    summary: "Any journey between two addresses: hospital appointments, stations, the office, shopping and long-distance trips.",
  },
  {
    slug: "meet-and-greet",
    href: "/services/meet-and-greet",
    icon: "user",
    title: "Meet & Greet",
    summary: "An optional extra for pickups: your driver meets you inside the arrivals hall.",
  },
  {
    slug: "corporate-travel",
    href: "/services/corporate-travel",
    icon: "suitcase",
    title: "Corporate travel",
    summary: "Airport transfers for businesses, including staff and client travel and regular trips.",
  },
];

/**
 * How Meet & Greet works. CONFIRM WITH THE BUSINESS before launch:
 * this wording describes the service and must match what drivers actually do.
 */
export const meetAndGreet = {
  description:
    "With Meet & Greet, your driver comes into the arrivals hall and waits with a sign showing your name, instead of meeting you outside at the car.",
  steps: [
    { title: "Add it when you book", text: "Meet & Greet appears as an optional extra on airport pickups. Its cost is shown in your quote." },
    { title: "Share your flight details", text: "Your flight number and landing time are saved with the booking." },
    { title: "Look for your name", text: "After you collect your bags, look for your driver holding a sign with your name in arrivals." },
  ],
};

/** Corporate topics the business has asked to cover. Phrased as enquiries, not commitments. */
export const corporateTopics: { title: string; text: string }[] = [
  { title: "Business airport transfers", text: "Transfers between offices, hotels or homes in London and the five London airports." },
  { title: "Corporate account enquiries", text: "Talk to us about setting up an account for your organisation." },
  { title: "Recurring travel", text: "Tell us about regular trips, such as weekly flights, and we can discuss how to arrange them." },
  { title: "Employee and client transfers", text: "Book on behalf of staff or visiting clients, with their details as the lead passenger." },
  { title: "Business booking support", text: "Contact us for help with group bookings, multiple journeys or changing plans." },
  { title: "Invoicing and account management", text: "Ask about invoicing and how bookings can be managed for your team." },
];
