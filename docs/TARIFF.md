# Location tariff: owner guide

How the website prices journeys that no reference fare covers, how to set the
figures so they stay at least £2 under the reference website, and how to add
event rates such as Christmas.

## How a price is chosen

For each vehicle, in this order:

1. **Matching reference fare**: an approved, in-date fare for exactly this journey (see `REFERENCE_FARES.md`). The price is the reference total **minus £2**.
2. **Location tariff**: if no fare matches, the price comes from the distance between the address and the airport, using the figures in `src/config/pricing.ts`.
3. **Price on request**: if neither applies, for example large or unusual items (bikes, golf bags), more passengers than the vehicle seats, or a journey with no airport.

The tariff is **switched off** until real figures are entered. While `isPlaceholder` is `true` in `src/config/pricing.ts`, the live website never uses it.

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
| `extras` | Meet & Greet, each child seat (charged once per booking), each extra stop |
| `timeSurcharges` | Optional night-time extra, as a percentage |
| `eventSurcharges` | Dates when the journey fare is multiplied (see below) |

Distance is estimated from the postcodes (straight line × 1.3 for London roads).

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
