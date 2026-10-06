import { fieldError } from "./errors";
import type { FieldError } from "./types";

export const contactTopics = {
  general: "General question",
  booking: "An existing booking",
  corporate: "Business or corporate travel",
} as const;

export type ContactTopic = keyof typeof contactTopics;

export interface ContactInput {
  topic: ContactTopic;
  name: string;
  email: string;
  phone?: string;
  bookingReference?: string;
  message: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Shared by the contact form and /api/contact. */
export function validateContact(input: ContactInput): FieldError[] {
  const errors: FieldError[] = [];
  if (!(input.topic in contactTopics)) errors.push(fieldError("topic", "BAD_REQUEST"));
  if (!input.name.trim()) errors.push(fieldError("name", "NAME_REQUIRED"));
  else if (input.name.length > 100) errors.push(fieldError("name", "TEXT_TOO_LONG", { max: 100 }));
  if (!EMAIL.test(input.email.trim())) errors.push(fieldError("email", "EMAIL_INVALID"));
  const phone = input.phone?.trim();
  if (phone && (phone.replace(/\D/g, "").length < 7 || phone.length > 20)) errors.push(fieldError("phone", "PHONE_INVALID"));
  if ((input.bookingReference?.length ?? 0) > 20) errors.push(fieldError("bookingReference", "TEXT_TOO_LONG", { max: 20 }));
  if (input.message.trim().length < 10) errors.push(fieldError("message", "MESSAGE_REQUIRED"));
  else if (input.message.length > 2000) errors.push(fieldError("message", "TEXT_TOO_LONG", { max: 2000 }));
  return errors;
}
