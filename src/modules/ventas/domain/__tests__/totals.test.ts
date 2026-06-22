import { describe, expect, it } from "vitest"
import { calculateTotals, VAT_RATE } from "../totals"

describe("totals domain rules", () => {
  it("calculates VAT and total for a subtotal of 1000", () => {
    const result = calculateTotals(1000)

    expect(result.subtotal).toBe(1000)
    expect(result.vat).toBe(100)
    expect(result.total).toBe(1100)
  })

  it("rounds values to two decimals", () => {
    const result = calculateTotals(99.999)

    expect(result.subtotal).toBe(100)
    expect(result.vat).toBe(10)
    expect(result.total).toBe(110)
  })

  it("uses the configured VAT rate", () => {
    expect(VAT_RATE).toBe(0.1)
  })
})
