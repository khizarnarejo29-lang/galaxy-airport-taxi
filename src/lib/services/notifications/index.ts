import type { ContactInput } from "@/lib/domain/contact";
import type { Booking } from "@/lib/domain/types";
import {
  bookingReceivedCustomerEmail,
  contactEnquiryEmail,
  newBookingOperatorEmail,
  type EmailMessage,
} from "./templates";

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Development sender: writes emails to the server log instead of sending them.
 * Swap for a real provider (Resend, Postmark, SES…) configured via env vars.
 */
export const logEmailSender: EmailSender = {
  async send(message) {
    console.info(`[email:not-sent] to=${message.to} subject="${message.subject}"\n${message.text}`);
  },
};

export interface Notifier {
  bookingReceived(booking: Booking): Promise<void>;
  contactEnquiry(input: ContactInput): Promise<void>;
}

/** `operatorEmail` receives new-booking alerts and contact enquiries. */
export function emailNotifier(sender: EmailSender, operatorEmail: string): Notifier {
  return {
    async bookingReceived(booking) {
      const messages = [bookingReceivedCustomerEmail(booking)];
      messages.push(newBookingOperatorEmail(booking, operatorEmail));
      await Promise.all(messages.map((m) => sender.send(m)));
    },
    async contactEnquiry(input) {
      await sender.send(contactEnquiryEmail(input, operatorEmail));
    },
  };
}
