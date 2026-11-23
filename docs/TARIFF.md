# Location tariff: owner guide

How the website prices journeys that no reference fare covers, how to set the
figures so they match the reference website without going above it, and how to add
event rates such as Christmas.

**Owner's rule (since 2026-11-23): as close as possible to the reference website's price, sometimes a
little above** (2026-11-22 to 23: never above it; before that, £2 under).

## How a price is chosen

For each vehicle, in this order:

1. **Matching reference fare**: an approved, in-date fare for exactly this journey (see `REFERENCE_FARES.md`). The price is the reference total (no deduction now; `referenceFareRules.discountPence` is 0).
2. **Location tariff**: if no fare matches, the price comes from the distance between the address and the airport, using the figures in `src/config/pricing.ts`.
3. **Price on request**: if neither applies, for example large or unusual items (bikes, golf bags), more passengers than the vehicle seats, or a transfer between terminals of the same airport.

The tariff is **switched on** (version `galaxy-2026-11-23`). Its figures were set from 76 quotes on the
reference website on 2026-11-22: fourteen London postcodes (SW1A 1AA, E1 5NF, HA9 0WS, CR0 1LF, RM1 1AU,
W5 2NU, E20 1EJ, E14 5AB, SW19 5AE, HA1 1BB, EN1 1YX, BR1 1EY, TW3 2EB, KT1 1TP) to each airport and four
places outside London, every vehicle, one way and return. The reference doesn't price by straight distance
alone (Stratford to Heathrow is £127 there, Whitechapel to Heathrow £84), so no formula can equal it
everywhere: the figures are fitted for the least total difference, and **never more than £5 above it for a
saloon, or £8 for a bigger vehicle, at any of those quotes** (one way: a saloon on average £5 under, an
8-seater £9 under; before 2026-11-23 they were £8.70 and £14 under). `src/lib/pricing/galaxy-tariff.test.ts`
holds the quotes and fails if a change takes a price further above the reference, or further under it on
average.

Outside Greater London the price is £34 plus £1.23 a mile whatever the airport (`outsideLondon`). A bigger
vehicle is a multiple of the saloon plus a fixed amount (`vehicleMultipliers`, `vehicleSurcharges`), but
never less than the saloon plus `vehicleMinimumUplift`: the 8-seater is 1.51 × the saloon less £3, and at
least the saloon plus £44, as on the reference site, where it is about £37–£54 more on short journeys. A return leg's 5% discount rounds down, as the
reference's returns do (£85 one way, £160 return).

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
`pricing.local` (owner's decisions: any journey, 2026-10-21; the reference site's price, 2026-11-22).
Saloon fare: £46 for the first 4 miles, then £1.30 a mile, plus £10 if either end is within 1.5 miles of
Charing Cross. Vehicles have their own local multipliers, fixed amounts and least uplifts (the 8-seater
is 1.26 × the saloon plus £25). Returns, stops, child seats
and the Christmas and New Year rates work as on airport journeys. The figures were set from 17
reference quotes on 2026-11-22 (a short trip in Whitechapel to London–Birmingham);
`galaxy-tariff.test.ts` checks no vehicle is more than £5 (saloon) or £8 above any of them.

## Between two airports

Heathrow to Gatwick and the other airport pairs are priced from `pricing.betweenAirports`: one fare
per vehicle for each pair, the same both ways, equal to the reference site's price (checked
2026-11-22). Returns get the usual 5% off each journey (rounded down, as the reference does), and Meet & Greet can be added because the driver
collects from arrivals. The tests check every pair, both directions, one way and return, against the
reference prices. Between terminals of the same airport is still price on request.

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
| `vehicleSurcharges` | A fixed amount added after the multiplier (negative for less) |
| `vehicleMinimumUplift` | The least a vehicle costs above the saloon fare |
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
  2. Re-check the tariff against the reference prices with those miles, and adjust the figures if any price would go above the reference.
  3. Then set `ROAD_DISTANCE=google` in Hostinger and rebuild.
- If Google can't be reached, search falls back to postcodes and the distance to the estimate, so quotes keep working.

## Keeping prices at the reference website's level

1. Record a range of reference fares as usual (different areas, each airport, each vehicle). They don't need to be in date for this check.
2. Enter your tariff figures in `src/config/pricing.ts`.
3. Run:

   ```
   npm run tariff:check
   ```

   Every stored reference fare is compared with what the tariff would charge for the same journey and vehicle. Each line says **OK** (at or under the reference), **TOO HIGH** (with how much over) or **SKIPPED** (with the reason).
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
