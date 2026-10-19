import { site } from "@/config/site";

/**
 * Galaxy Airport Taxi Privacy Policy.
 *
 * Describes only what this website actually does today. Before adding analytics,
 * advertising/tracking tags, online payments, call or chat recording, or new
 * service providers, update this policy first. No retention periods,
 * registrations or third-party processors are stated until confirmed.
 * SUBJECT TO FINAL LEGAL REVIEW before launch.
 */

export type PrivacyBlock = string | { list: string[] };

export interface PrivacySection {
  id: string;
  title: string;
  blocks: PrivacyBlock[];
}

/** Date this version of the policy was written. Update whenever the policy changes. */
export const privacyLastUpdated = "20 October 2026";

export function privacySections(): PrivacySection[] {
  return [
    {
      id: "about",
      title: "About this policy",
      blocks: [
        `This Privacy Policy explains how ${site.name} ("we", "us", "our") collects, uses and looks after personal information when you use our website to get a quote, book an airport transfer or contact us.`,
        `${site.name} is responsible for the personal information described in this policy. Our contact details are at the end of this page.`,
      ],
    },
    {
      id: "information-we-collect",
      title: "Information we collect",
      blocks: [
        "When you get a quote or make a booking, we collect the details needed to price and arrange your journey:",
        {
          list: [
            "Your name, email address and phone number",
            "Your pickup location and destination, including any extra stops you add",
            "Your travel date and time",
            "The number of passengers travelling",
            "Your luggage (hand luggage and suitcases, and how many of each)",
            "The airport and, where relevant, the terminal",
            "Your flight number, where you provide it",
            "Extras you choose, such as Meet & Greet or child seats",
            "Any special requirements or notes you add to your booking",
          ],
        },
        "When you contact us through our contact form, we collect your name, email address, the topic of your enquiry and your message, plus your phone number and booking reference if you choose to give them.",
        "If you book on behalf of someone else, such as a colleague or a family member, you may give us their details as the lead passenger. Please make sure they know you are sharing their information with us for this purpose.",
      ],
    },
    {
      id: "how-we-use-it",
      title: "How we use your information",
      blocks: [
        "We use your information to:",
        {
          list: [
            "Work out and show you a quote for your journey",
            "Arrange and carry out the journey you book, including collecting you from the right place at the right time",
            "Match airport pickups to your flight using the flight number and landing time you provide",
            "Contact you about your booking, for example if we need to check or change any details",
            "Reply to questions and requests you send us",
            "Keep a record of bookings and enquiries",
            "Help protect our website and forms from misuse, such as automated spam",
            "Meet legal and regulatory obligations that apply to us",
          ],
        },
      ],
    },
    {
      id: "lawful-bases",
      title: "Our reasons for using your information",
      blocks: [
        "Under UK data protection law, we must have a valid reason (a lawful basis) to use personal information. Depending on the situation, we rely on:",
        {
          list: [
            "Contract: to give you a quote and to arrange and provide the journey you book with us",
            "Legitimate interests: to respond to enquiries, keep records, run and protect our website and business, and deal with any disputes, where this does not override your rights",
            "Legal obligation: where we need to keep or share information to comply with the law",
          ],
        },
      ],
    },
    {
      id: "sharing",
      title: "Who we share your information with",
      blocks: [
        "We only share personal information where it is needed for the purposes described in this policy. This may include sharing it with:",
        {
          list: [
            "The people who carry out your journey, so they can collect you and take you to your destination",
            "Service providers that help us run our website and handle bookings and enquiries, only as far as needed to provide their services to us",
            "Authorities or other organisations, where we are required to by law or need to in order to protect our legal rights",
          ],
        },
        "Our address search sends the postcode or area name you type to a postcode lookup service so it can suggest matching locations. Your name and contact details are not sent with these searches.",
        "If you pay online by card, the payment is handled by our payment provider on its own secure page. We don't see or keep your card details.",
        "If you book or message us on WhatsApp, the message is carried by WhatsApp under its own privacy policy, and we use it to arrange your journey.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies and your browser",
      blocks: [
        "Our website does not currently use analytics, advertising or tracking cookies.",
        "We use one small security cookie after you book, so that only the browser that made the booking can see its full confirmation page. It lasts 60 minutes. It is needed for the service you asked for, so it doesn't need your consent.",
        "Our quote calculator saves your progress in your browser's session storage, so you don't lose your details if you refresh the page. This information stays in your browser, is removed once your booking is complete, and is cleared when you close the browser tab.",
        "If we introduce other cookies or similar technologies in the future, we will update this policy first.",
      ],
    },
    {
      id: "data-security",
      title: "Data security",
      blocks: [
        "We take appropriate technical and organisational measures designed to protect personal information against loss, misuse and unauthorised access, and we only allow access to it where there is a need to know.",
        "No website or method of sending information over the internet can be guaranteed to be completely secure, but we work to protect the information you give us.",
      ],
    },
    {
      id: "data-retention",
      title: "Data retention",
      blocks: [
        "We keep personal information only for as long as is reasonably necessary for the purposes it was collected for. This includes providing our service, meeting applicable legal obligations, resolving disputes and protecting our legitimate business interests, where applicable.",
        "When we no longer need personal information, we delete it or make sure it can no longer identify you.",
      ],
    },
    {
      id: "your-rights",
      title: "Your privacy rights",
      blocks: [
        "Under UK data protection law, you have rights over your personal information. Depending on the circumstances, these include the right to:",
        {
          list: [
            "Ask for a copy of the personal information we hold about you",
            "Ask us to correct information that is inaccurate or incomplete",
            "Ask us to delete your information",
            "Ask us to restrict how we use your information",
            "Object to us using your information where we rely on legitimate interests",
            "Ask for information you gave us to be transferred to you or another organisation in a commonly used format",
          ],
        },
        "Some of these rights only apply in certain situations, and requests may be subject to legal requirements and limitations. For example, we may need to keep some information to meet a legal obligation. We may also need to confirm your identity before acting on a request.",
        "We will respond to your request within the time required by applicable data protection law.",
        "If you are unhappy with how we have handled your information, please contact us first so we can try to help. You also have the right to complain to the Information Commissioner's Office (ICO), the UK's data protection regulator, at ico.org.uk.",
      ],
    },
    {
      id: "contact",
      title: "Contacting us about privacy",
      blocks: [
        "For any question about this policy, or to make a request about your personal information, contact us:",
        { list: [site.name, site.address ?? "", `Email: ${site.email}`, `Phone: ${site.phone.display}`].filter(Boolean) },
      ],
    },
    {
      id: "changes",
      title: "Changes to this Privacy Policy",
      blocks: [
        "We may update this policy from time to time, for example if our services or the way we use personal information change. The latest version will always be published on this page, with the date it was last updated shown at the top.",
      ],
    },
  ];
}
