# Booking emails and the bookings page

## Emails

With a mailbox set up, every booking sends two emails:

- to the customer: "Booking received", with the reference and journey;
- to you (BOOKINGS_NOTIFY_EMAIL, or info@galaxyairporttaxi.co.uk): "New booking", with the
  customer's name, phone and email and the full journey.

The contact form's enquiries come to you the same way.

### Set up (Hostinger)

1. hPanel → **Emails**: make sure the mailbox `info@galaxyairporttaxi.co.uk` exists and you
   know its password (change it there if not).
2. hPanel → the website's Node.js app → **Environment variables**, add:

| Name | Value |
| --- | --- |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `info@galaxyairporttaxi.co.uk` |
| `SMTP_PASSWORD` | the mailbox password |

3. Restart the app, make a test booking with your own email, and check both inboxes
   (and the spam folder the first time).

On your phone, add the mailbox to the Gmail or Mail app so new bookings arrive as notifications.

## Bookings page

`https://galaxyairporttaxi.co.uk/admin` lists the newest 100 bookings; tap one for every detail.

Add `ADMIN_PASSWORD` (10 or more characters, not used anywhere else) to the environment
variables and restart. Sign-in lasts 12 hours on that device. Search engines are told not to
list the page.
