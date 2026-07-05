/**
 * VAT rate set to 0 because catalog prices are IVA-inclusive.
 * The backend owns fiscal breakdown — the frontend MUST NOT add VAT on top.
 */
export const VAT_RATE = 0

export interface Totals {
  subtotal: number
  vat: number
  total: number
}

export function calculateTotals(subtotal: number): Totals {
  const roundedSubtotal = Number(subtotal.toFixed(2))
  // VAT is always 0 — catalog prices already include IVA
  const vat = 0
  const total = roundedSubtotal
  return { subtotal: roundedSubtotal, vat, total }
}
