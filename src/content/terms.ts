import { cancellationPolicy } from "./policies";

export interface TermsSection {
  id: string;
  title: string;
  paragraphs: string[];
}

/** Published sections of the Terms and Conditions. Further sections are added as the business confirms them. */
export function termsSections(): TermsSection[] {
  const days = cancellationPolicy.refundProcessingBusinessDays;
  return [
    {
      id: "cancellation-and-refunds",
      title: "Booking cancellation and refunds",
      paragraphs: [
        `If you cancel a booking and the cancellation is eligible for a refund under the applicable cancellation policy, we will process your refund within ${days} business days.`,
        `This ${days}-business-day period is the time we take to process the refund. After that, your bank or card provider may need additional time before the funds appear in your account.`,
        ...cancellationPolicy.additionalRules,
      ],
    },
  ];
}
