export const VAT_RATE = 0.1

export interface Totals {
  subtotal: number
  vat: number
  total: number
}

export function calculateTotals(subtotal: number): Totals {
  const roundedSubtotal = Number(subtotal.toFixed(2))
  const vat = Number((roundedSubtotal * VAT_RATE).toFixed(2))
  const total = Number((roundedSubtotal + vat).toFixed(2))
  return { subtotal: roundedSubtotal, vat, total }
}
