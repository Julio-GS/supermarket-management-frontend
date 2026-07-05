const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format a number or decimal string as ARS currency. Returns "$0,00" for invalid inputs. */
export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? Number.parseFloat(value) : value
  if (!Number.isFinite(num)) return currencyFormatter.format(0)
  return currencyFormatter.format(num)
}
