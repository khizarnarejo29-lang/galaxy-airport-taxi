# Card payments (Stripe Checkout)

After "Confirm and pay", the booking is saved and the customer goes to Stripe's
own card page. Card details never reach this website. Stripe then tells the site
the payment went through (a webhook), and the booking is marked **Paid by card**.

The amount is always the booking's saved total, worked out by the server.

## What is needed

1. **Booking storage (Supabase).** Without it, production refuses bookings, so
   there is nothing to pay for. Card payments stay off until it is set.
2. **A Stripe account** (stripe.com) for Galaxy Airport Taxi, with the business
   and bank details filled in so Stripe can pay out.
3. Two keys, set in Hostinger's environment variables (never in the code):

| Variable | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key (`sk_live_…`, or `sk_test_…` for testing) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → Add endpoint (see below) → Signing secret (`whsec_…`) |

### The webhook

- Endpoint URL: `https://galaxyairporttaxi.co.uk/api/payments/stripe`
- Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`

Restart the site after setting the keys. Until both keys are set, bookings are
taken unpaid ("To be arranged") exactly as before.

## Testing first

Use the test keys (`sk_test_…` and a test webhook's `whsec_…`), make a booking,
and pay with Stripe's test card `4242 4242 4242 4242`, any future date, any CVC.
The booking page should then show "Paid by card". Switch to the live keys only
after that works.

## If something goes wrong

- The card page can't be opened: the booking still stands, and its page shows a
  "Pay £… by card" button to try again.
- The customer cancels on the card page: they come back to the booking page,
  aren't charged, and can pay from there.
- A payment that doesn't match the booking total is still recorded as paid, and
  flagged `PAYMENT_AMOUNT_MISMATCH` for the operator to check.
