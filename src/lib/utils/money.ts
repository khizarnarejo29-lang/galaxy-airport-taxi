/** All money is handled as integer pence to avoid floating-point drift. */
export type Pence = number;

const gbpWhole = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatGBP(pence: Pence): string {
  return pence % 100 === 0 ? gbpWhole.format(pence / 100) : gbp.format(pence / 100);
}

export function roundTo(pence: Pence, step: Pence): Pence {
  return step > 0 ? Math.round(pence / step) * step : Math.round(pence);
}
