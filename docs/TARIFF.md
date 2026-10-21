# Location tariff: owner guide

How the website prices journeys that no reference fare covers, how to set the
figures so they stay at least £2 under the reference website, and how to add
event rates such as Christmas.

## How a price is chosen

For each vehicle, in this order:

1. **Matching reference fare**: an approved, in-date fare for exactly this journey (see `REFERENCE_FARES.md`). The price is the reference total **minus £2**.
2. **Location tariff**: if no fare matches, the price comes from the distance between the address and the airport, using the figures in `src/config/pricing.ts`.
3. **Price on request**: if neither applies, for example large or unusual items (bikes, golf bags), more passengers than the vehicle seats, or a journey from one airport to another.

The tariff is **switched on** (version `galaxy-2026-10-20`). Its figures were set from 32 quotes on the
reference website on 2026-10-19: six London postcodes (SW1A 1AA, E1 5NF, HA9 0WS, CR0 1LF, RM1 1AU, W5 2NU)
to each airport, every vehicle, one way and return. At every one of them the tariff is at least £3 under the
reference price: the £2 rule plus £1 to spare for the places in between. `src/lib/pricing/galaxy-tariff.test.ts`
holds those quotes and fails if a change takes any price above reference − £2.

What the reference site does, and the tariff copies:

- Prices include airport drop-off and parking, so `dropOffCharge` and `pickupParking` are `0`.
- A return is 5% off both journeys (`returnDiscountPercent`). Customers see two lower leg fares, no discount line.
- Central London costs more (`centralZone`, `centralSupplement`).
- Heathrow Terminal 5 costs more than Terminal 2 (£8 more for E1 5NF), so T2, T3 and T4 are £8 less (`terminalAdjustments`).

Still to confirm: Gatwick North Terminal (priced as South), Heathrow T3 and T4 (assumed like T2), and
places far from the six samples.

Extras: Meet & Greet is £6, as on the reference site. A stop is £10 plus the extra miles (the reference
charged £16 more for a stop on one checked route). Child seats are free (owner's decision), so they add nothing to the price.

## Journeys with no airport (local rides)

Any journey between two addresses (hospital, station, office, shops, long distance) is priced by
`pricing.local` (owner's decision, 2026-10-21: at least £2 under the reference website). Saloon fare:
£38 for the first 4 miles, then £1.40 a mile for the next 20 miles and £1.30 a mile after that, plus
£12 if either end is within 1.5 miles of Charing Cross. Other vehicles use `vehicleMultipliers`,
except the 8-seater at 1.43 on local journeys. Returns, stops, child seats and the Christmas and New
Year rates work as on airport journeys. The figures were set from 18 reference quotes (a short trip
in Whitechapel to London–Birmingham); `galaxy-tariff.test.ts` checks every vehicle stays at least £2
under each one. Airport to airport is still price on request.

## The figures to set

All amounts are in pence (`4500` = £45.00).

| Setting | Meaning |
| --- | --- |
| `airports.LHR.baseFare` (and LGW, STN, LTN, LCY) | Saloon fare for the first `includedMiles` |
| `includedMiles` | Miles covered by the base fare |
| `perMile` | Each mile after that |
| `minimumFare` | Lowest saloon fare for that airport |
| `dropOffCharge` / `pickupParking` | Airport drop-off charge or parking, added on top. Use `0` if your fares already include them |
| `vehicleMultipliers` | Estate, Executive, MPV and 8-Seater as a multiple of the saloon fare (`1.2` = 20% more) |
| `extras` | Meet & Greet, each child seat (charged once per booking), each extra stop. `null`: not priced, so price on request |
| `centralZone` / `centralSupplement` | Centre and radius of central London, and the extra per airport for it |
| `terminalAdjustments` | Extra (or less, if negative) for a terminal, e.g. Heathrow `T2: -800` |
| `returnDiscountPercent` | Taken off both journeys of a return |
| `timeSurcharges` | Optional night-time extra, as a percentage |
| `eventSurcharges` | Dates when the journey fare is multiplied (see below) |

Distance is estimated from the postcodes (straight line × 1.3 for London roads), unless real road miles are switched on.

### Google address search and real road miles

- `GOOGLE_MAPS_API_KEY` (server only, never shown to the browser) turns on Google address search: streets, house numbers, hotels and stations, as on the reference website. Needs **Places API (New)** enabled on the key.
- Real driving miles also need `ROAD_DISTANCE=google` and the **Routes API**. The tariff figures were set against the estimate, so before switching it on:
  1. Put the key in `.env.local` and run `npm run road-miles`. It saves the real miles for the six sample postcodes to `src/config/road-miles.json` (the key is never printed or saved).
  2. Re-check the tariff against the reference prices with those miles, and adjust the figures if any price is no longer at least £2 under.
  3. Then set `ROAD_DISTANCE=google` in Hostinger and rebuild.
- If Google can't be reached, search falls back to postcodes and the distance to the estimate, so quotes keep working.

## Keeping prices £2 under the reference website

1. Record a range of reference fares as usual (different areas, each airport, each vehicle). They don't need to be in date for this check.
2. Enter your tariff figures in `src/config/pricing.ts`.
3. Run:

   ```
   npm run tariff:check
   ```

   Every stored reference fare is compared with what the tariff would charge for the same journey and vehicle. Each line says **OK** (at least £2 under), **TOO HIGH** (with how much over) or **SKIPPED** (with the reason).
4. Lower the figures behind any TOO HIGH line and run it again until none are left.

The check only covers journeys you have recorded, so record enough of them to be confident about every area and airport.

## Event rates (Christmas and other dates)

`eventSurcharges` lists date windows in London time. During a window the **journey fare** is multiplied; extras and airport charges are not. The customer sees the full total with "Includes Christmas rate" (or the event's name) under the price, and the rate as its own line in the price breakdown.

```ts
{ label: "Christmas rate", from: { date: "12-24", time: "18:00" }, to: { date: "12-26", time: "23:59" }, multiplier: 2, enabled: true },
```

- Dates are `MM-DD`, so a window repeats every year. A window can cross the new year (`12-31` to `01-01`).
- `multiplier: 2` doubles the fare; `1.5` adds half.
- For a one-off London event, add a window with its own label and set `enabled: false` afterwards (or remove it).
- Where windows overlap, the highest multiplier applies.

Christmas and New Year are set to double, using the same windows the reference website publishes for its holiday surcharge. A matching reference fare is never used inside those windows, so the tariff (with the event rate) prices them instead.

## Switching the tariff on

1. Enter real figures and pass `npm run tariff:check`.
2. In `src/config/pricing.ts`, set `isPlaceholder: false` and give `version` a new name (for example `galaxy-2026-11-01`). Change `version` every time any figure changes.
3. Run the tests, build, and deploy as usual.

To try placeholder figures on your own computer only: `PLACEHOLDER_TARIFF=on npm run dev`. This never works on the live site.
