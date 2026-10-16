# Reference fares: owner guide

How to record, approve and maintain the reference fares that set Galaxy Airport Taxi's online prices.

## How pricing works

- An online price is shown **only** when a stored fare matches the customer's journey exactly and is **approved** and **in date**.
- Galaxy's price is the reference total **minus £2.00**, taken off **once per booking**. A £160 return becomes £158, not £156.
- Every other journey shows **"Price on request"** and the customer is asked to call. Nothing is ever estimated.
- A fare is valid for exactly **168 hours (7 days)** from the moment it was checked. After that it stops being used automatically.
- **Pending** fares are never used for pricing.

## Rules

1. **Check fares by hand only.** Use the reference website in a normal browser. Never use scripts, bots or automated tools. The reference site's Acceptable Use Policy forbids copying its site.
2. **Record exactly what you saw.** Don't round, guess, or reuse a price for a different address, terminal, vehicle, date or luggage combination.
3. **Never edit `src/data/reference-fares.json` by hand.** Always use the template and the import command, which check everything.
4. The **Executive People Carrier** has no Galaxy equivalent. Don't record it.

## Who does what

- **Checker**: looks up the fare on the reference website and fills in a row of the template.
- **Approver** (the owner): reviews the row and sets it to `approved` with their name and the approval time.
- **Developer**: runs the import, reviews the change and publishes it. Every change needs a new deployment.

## Step by step

### 1. Check the fare on the reference website

1. Open https://www.airporttaxis-uk.co.uk/ in a normal browser.
2. Enter the **exact** pickup and drop-off: for an address, the house number and street; for an airport, the **terminal**.
3. Enter the travel date, passengers, luggage, stops and extras exactly as the customer would, if the site asks for them.
4. Note the **total shown** for each vehicle, for one-way and for return. Stop before any personal details are asked for, and never book.
5. Note the **date and time** of your check, with the UK offset (`+01:00` in summer, `+00:00` in winter).

### 2. Record it in the template

Copy `docs/reference-fares-template.csv`, open it in Google Sheets or Excel, and add one row per fare.

### 3. Approve

The approver checks each row. For each row they're happy with, they set:

- `status` = `approved`
- `approved_by` = their name
- `approved_at` = the approval time, which can't be earlier than `checked_at`

Rows left as `pending` are imported but never priced.

### 4. Import

Save the sheet as **CSV (UTF-8)**, then run:

```
npm run fares:import -- path/to/fares.csv --dry-run
```

This only checks the file. Fix any problems it lists; each one names the spreadsheet row. When the check passes, run it again without `--dry-run` to write the fares:

```
npm run fares:import -- path/to/fares.csv
```

If **any** row has a problem, **nothing** is written. The import replaces all stored fares with the rows in the file, so always import the **complete** list.

### 5. Publish

The developer reviews the change to `src/data/reference-fares.json` and deploys it (with the owner's go-ahead). Until it's deployed, the website keeps using the previous fares.

### 6. Check the report regularly

```
npm run fares:report
```

Run it at least **daily**: fares expire after 7 days. It lists:

- **Expired**: no longer priced. Re-check or remove them.
- **Expiring within 24 hours**: re-check these soon.
- **Pending**: waiting for approval, never priced.
- **All verified travel dates have passed**: can't price any journey. Re-check them for new dates, or remove them.
- **In use**: approved, in date and with upcoming verified dates.

If the fare file is ever invalid, the report says so and the website prices nothing until it's fixed.

To see what the list will look like later, add a time: `npm run fares:report -- --now 2026-11-02T09:00:00+00:00`.

## Re-checking a fare

Add the new check as a **new row** with a different `id` and `status` = `pending`, next to the approved one. Once it's approved, remove the old row and import again. Two approved rows for the same journey are rejected.

## Columns

Leave a cell **blank** when it doesn't apply. Lists use `;` between items.

| Column | What to enter | Format / example |
| --- | --- | --- |
| `id` | A unique name for the row | `GREATOREX-E15NF_LHR-T5_TO_ONEWAY_SALOON_2026-10-20` |
| `status` | `pending` or `approved` | `pending` |
| `source_url` | The reference page where you saw the price | must start `https://www.airporttaxis-uk.co.uk/` |
| `pickup_line1` / `pickup_postcode` | If the pickup is an address: house number and street exactly as chosen on the reference site, and the full postcode with a space. Leave blank for an airport | `12-14, Greatorex Street` (commas are fine) / `E1 5NF` |
| `pickup_airport` | If the pickup is an airport: `LHR`, `LGW`, `STN`, `LTN` or `LCY`. Leave blank for an address | `LHR` |
| `pickup_terminal` | Airport pickups only: Heathrow `T2`–`T5`, Gatwick `N` or `S`; **blank** for Stansted, Luton and London City, and for addresses | `T5` |
| `dropoff_line1` / `dropoff_postcode` / `dropoff_airport` / `dropoff_terminal` | The drop-off, with the same rules as the pickup columns. Pickup and drop-off can't both be airports | |
| `trip_type` | `one_way` or `return` | `one_way` |
| `return_route` | Returns only: `confirmed` if you saw the return route, otherwise `unconfirmed` (never priced) | `confirmed` |
| `return_pickup_line1` / `return_pickup_postcode` / `return_pickup_airport` / `return_pickup_terminal` | Returns only, if confirmed: where the way back starts, with the same rules as the pickup columns. It can be an address, or the airport the outward journey went to (any terminal). The way back always ends at the outward pickup, so that isn't entered again | |
| `return_stops` | Returns only: postcodes of stops on the way back | `E2 7DG; E3 2AA` |
| `reference_vehicle` | The vehicle as named on the reference site | `Saloon Car`, `Estate Car`, `Executive Car`, `People Carrier`, `8 Seater Minibus` |
| `galaxy_vehicle` | Optional check: the Galaxy vehicle it maps to | `saloon`, `estate`, `executive`, `mpv`, `minibus` |
| `confirmed_parties` | Each passenger count and luggage category you checked, and confirmed fits **both** the reference vehicle and the Galaxy vehicle | `1p suitcases; 2p hand luggage` |
| `stops` | Postcodes of stops on the outward leg, in order | `E2 7DG` |
| `meet_and_greet` | `yes` or `no`. Only possible when the pickup, or the return pickup, is an airport | `no` |
| `child_seats` | Number of child seats included | `0` |
| `verified_travel_dates` | Travel dates the price was seen for. Returns use `outbound>return` | `2026-10-20; 2026-10-21` or `2026-10-20>2026-10-27` |
| `reference_total_gbp` | The total shown, in pounds and pence, without commas | `84.00` |
| `currency` | Always `GBP` | `GBP` |
| `vat_included` | Must be `yes` (the reference shows prices including VAT) | `yes` |
| `checked_at` | When you checked, with the UK offset. Can't be in the future | `2026-10-20T09:15:00+01:00` |
| `checked_by` | Who checked | `Owner name` |
| `approved_by` / `approved_at` | Approved rows only | name, and a time like `checked_at` |
| `expires_at` | For your information only: **ignored** by the import, which always uses `checked_at` + 168 hours | |
| `notes` | Anything useful | |

`confirmed_parties` code: `2p suitcases` means 2 passengers with suitcases. The luggage category is one of `none`, `hand luggage` or `suitcases`, the same choice customers make in the calculator and the reference site asks for. A customer's journey matches only a combination listed **exactly**: a fare checked for `2p suitcases` does **not** price 3 passengers, or 2 passengers with hand luggage. List only combinations you actually checked on the reference site and know your vehicle can take; never add others because the price "looked the same".

The source URL is stored with the fare as `Source: …` at the start of its notes.

## What customers see

- **Matching, approved, in-date fare**: a fixed total (reference total − £2) that they can book online.
- **Anything else**: "Price on request", with the Galaxy phone number. This covers no fare, an expired or pending fare, a different pickup, drop-off, house number, terminal, date, vehicle, luggage, stop or extra, an area chosen without a full postcode, the reference site's published Christmas and New Year surcharge dates, and any customer who says they're bringing large or unusual items (such as bikes or golf bags). Checked fares never cover large or unusual items, so don't record fares for them.

## Common import problems

- **Dates or times changed by Excel**: format those columns as **Text** before typing, or use Google Sheets. Dates must be `YYYY-MM-DD`; times must include `+01:00` or `+00:00`.
- **"checkedAt is in the future"**: check the date, and the `+01:00` / `+00:00` offset.
- **"leave blank"**: the cell must be empty for that airport, end or journey type.
- **"fill in either an airport or an address, not both"**: each end is one or the other.
- **"Describes the same booking"**: two rows with the same status describe the same journey. Keep one.
- **Postcode errors**: use capitals and a space, e.g. `E1 5NF`.
