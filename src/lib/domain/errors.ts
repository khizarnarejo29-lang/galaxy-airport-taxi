import { site } from "@/config/site";
import type { FieldError } from "./types";

/** Every error the quote/booking system can return, with customer-facing wording. */
export const errorMessages = {
  AIRPORT_REQUIRED: "Choose an airport.",
  ADDRESS_REQUIRED: "Search for the address or postcode and pick it from the list.",
  ADDRESS_OUTSIDE_AREA: "This address is outside the area we currently cover online.",
  ADDRESS_LINE_REQUIRED: "Add your house number and street so the driver can find you.",
  ROUTE_UNSUPPORTED: "We can't quote journeys between two airports online. Please call us.",
  SAME_LOCATION: "Your pickup and drop-off are the same place. Please check both.",
  STOP_SAME_LOCATION: "This stop is the same place as your pickup or drop-off.",
  STOP_DUPLICATE: "You've already added this stop. Please choose a different one.",
  RETURN_PICKUP_INVALID: "We can't collect you from there for your return journey online. Please call us.",
  STOP_LIMIT: "You can add up to {max} extra stops.",
  DATE_REQUIRED: "Choose a date.",
  DATE_INVALID: "Enter a valid date.",
  DATE_IN_PAST: "This date has already passed.",
  DATE_TOO_FAR: "Online bookings can be made up to {days} days ahead.",
  TIME_REQUIRED: "Choose a time.",
  TIME_INVALID: "Enter a valid time.",
  TIME_TOO_SOON: "Online bookings need at least {hours} hours' notice. For sooner journeys, please call us.",
  PASSENGERS_REQUIRED: "Tell us how many passengers are travelling.",
  PASSENGERS_INVALID: "Enter a passenger count of 1 or more.",
  CAPACITY_EXCEEDED: "That's more than our largest vehicle carries. Please call us to arrange a group booking.",
  LUGGAGE_INVALID: "Enter a valid number of cases.",
  LUGGAGE_CATEGORY_REQUIRED: "Choose your luggage: none, hand luggage or suitcases.",
  LARGE_ITEMS_REQUIRED: "Tell us whether you're bringing any large or unusual items.",
  TERMINAL_REQUIRED: "Choose your terminal.",
  TERMINAL_INVALID: "Choose a terminal from the list.",
  FLIGHT_NUMBER_REQUIRED: "Add your flight number so your driver knows which arrival to meet.",
  FLIGHT_NUMBER_INVALID: "Enter a flight number like BA2490 or EZY8012.",
  VEHICLE_REQUIRED: "Choose a vehicle.",
  VEHICLE_UNAVAILABLE: "This vehicle can't take your group and luggage. Please choose another.",
  CHILD_SEATS_INVALID: "You can request up to {max} child seats.",
  NAME_REQUIRED: "Enter the lead passenger's name.",
  EMAIL_INVALID: "Enter a valid email address.",
  PHONE_INVALID: "Enter a valid phone number, including the country code if outside the UK.",
  TEXT_TOO_LONG: "Please keep this under {max} characters.",
  MESSAGE_REQUIRED: "Please write a short message (at least 10 characters).",
  LOCATION_LOOKUP_FAILED: "Address search isn't responding right now. Please try again, or contact us for a quote.",
  RETURN_JOURNEY_REQUIRED: "Add the details of your return journey.",
  RETURN_BEFORE_OUTBOUND: "Your return pickup must be after your outward journey.",
  FARE_UNAVAILABLE: "We can't confirm an instant price for this journey any more. Please contact us for a quote.",
  BOOKING_UNAVAILABLE: `We couldn’t save your booking, so it has not been made. Please call us on ${site.phone.display} to book.`,
  QUOTE_EXPIRED: "Your quote has expired. We've refreshed the price for you.",
  QUOTE_INVALID: "We couldn't verify this quote. Please get a new quote.",
  PRICE_CHANGED: "The price has changed since you were quoted. Please review the new total.",
  BAD_REQUEST: "Something in this request wasn't right. Please check your details.",
  SERVER_ERROR: "Something went wrong on our side. Please try again in a moment.",
} as const;

export type ErrorCode = keyof typeof errorMessages;

export function fieldError(
  field: string,
  code: ErrorCode,
  vars: Record<string, string | number> = {},
): FieldError {
  const message = errorMessages[code].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
  return { field, code, message };
}

/** Standard error response body for API routes. */
export interface ApiErrorBody {
  ok: false;
  errors: FieldError[];
}
